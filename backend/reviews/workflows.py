"""Durable bulk review execution on DBOS (workflow state checkpointed in Postgres).

run_review         one per review; pages through unfinished items and enqueues
                   one process_document workflow per document onto the queue.
process_document   one per (review, document); extract → verify → save.

The queue enforces per-process concurrency and a global rate limit, which is
the real bottleneck at scale (model provider limits), not orchestration.
Workflow IDs are deterministic per run (review, run number, document), so
double-starts and re-enqueues are no-ops, and a crashed process resumes
unfinished workflows on restart. Retrying failed rows starts a new run number.
"""

from dbos import DBOS, DBOSConfig, SetWorkflowID

from backend import db, llm
from backend.config import settings
from backend.extraction.extract import answers_to_json, extract, verify_answers
from backend.models import Column

QUEUE = "extract"
ENQUEUE_PAGE = 500


def launch() -> None:
    s = settings()
    config: DBOSConfig = {"name": "bulk-review", "system_database_url": s.dbos_database_url}
    DBOS(config=config)
    DBOS.launch()
    DBOS.register_queue(
        QUEUE,
        worker_concurrency=s.extract_concurrency,
        limiter={"limit": s.extract_rate_per_min, "period": 60},
        on_conflict="always_update",
    )


def start_review(review_id: str, run: int) -> None:
    with SetWorkflowID(f"review-{review_id}-r{run}"):
        DBOS.start_workflow(run_review, review_id, run)


# --- Workflows ---------------------------------------------------------------

@DBOS.workflow()
def run_review(review_id: str, run: int) -> None:
    handles, after = [], None
    while ids := _pending_page(review_id, after):
        for doc_id in ids:
            with SetWorkflowID(f"review-{review_id}-r{run}-doc-{doc_id}"):
                handles.append(DBOS.retrieve_queue(QUEUE).enqueue(process_document, review_id, doc_id))
        after = ids[-1]
    for h in handles:
        h.get_result()
    _mark_complete(review_id)


@DBOS.workflow()
def process_document(review_id: str, document_id: str) -> None:
    _mark_running(review_id, document_id)
    try:
        answers_json, tokens_in, tokens_out = _extract(review_id, document_id)
    except Exception as e:  # permanent errors, or retries exhausted
        _mark_failed(review_id, document_id, _error_message(e))
        return
    _save(review_id, document_id, answers_json, tokens_in, tokens_out)


# --- Steps -------------------------------------------------------------------

@DBOS.step()
def _pending_page(review_id: str, after: str | None) -> list[str]:
    return db.pending_document_ids(review_id, after, ENQUEUE_PAGE)


@DBOS.step()
def _mark_running(review_id: str, document_id: str) -> None:
    db.set_item_running(review_id, document_id)


@DBOS.step(
    retries_allowed=True, max_attempts=5, interval_seconds=2, backoff_rate=2,
    should_retry=lambda e: isinstance(e, llm.RETRYABLE),
)
def _extract(review_id: str, document_id: str) -> tuple[str, int, int]:
    # Load inside the step so document text is never checkpointed; only IDs and answers are.
    pages = db.get_pages(document_id)
    columns = [Column.model_validate(c) for c in db.get_review_columns(review_id)]
    answers, usage = extract(pages, columns)
    answers = verify_answers(answers, pages)
    return answers_to_json(answers), usage.input_tokens, usage.output_tokens


@DBOS.step()
def _save(review_id: str, document_id: str, answers_json: str, tokens_in: int, tokens_out: int) -> None:
    db.save_item_done(review_id, document_id, answers_json, tokens_in, tokens_out)


@DBOS.step()
def _mark_failed(review_id: str, document_id: str, error: str) -> None:
    db.save_item_failed(review_id, document_id, error)


@DBOS.step()
def _mark_complete(review_id: str) -> None:
    db.set_review_status(review_id, "complete")


def _error_message(e: Exception) -> str:
    if isinstance(e, llm.PermanentLLMError):
        return str(e)
    cause = e.__cause__ or e.__context__
    return f"{type(e).__name__}: {str(cause or e).splitlines()[0]}"
