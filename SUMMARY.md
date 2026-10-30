# Arca Reviewer: design summary

## What it does

**Select → ask → run → verify → review.**

1. **Select documents.** Pick them with filters on type, authority, product, date and full text. Or describe them in plain English: gpt-5-mini turns the description into the *same* editable filter, so nothing about the selection is hidden.
2. **Ask.** Write questions as typed columns (text, list, date, number, yes/no, one-of). Start from a template or from scratch, and preview the answers on one document before running.
3. **Run.** Each document gets one gpt-5 call that answers every column, executed durably on DBOS.
4. **Review.** Results fill a live grid. Clicking a cell opens the evidence pane, which shows each quote, its page, whether it was verified, and the highlighted passage in the source text. Failed rows can be retried, and the whole grid exports to CSV.

## Key decisions

- **One call per document, covering all questions.** The document is the expensive part of the prompt, so it is paid for once instead of once per column, and the answers stay consistent with each other. The document goes first and the questions last, so the prefix is cacheable.
- **A strict JSON schema generated from the columns.** Each column becomes `{status, quotes[], value}`. `quotes` comes before `value`, so the model commits to evidence before it answers. `not_found` is a real status, so the model is never pushed into guessing. Output that fails validation is retried once, then the row fails with a reason.
- **Citations are checked, not trusted.** Every quote is fuzzy-matched against the page text (rapidfuzz `partial_ratio ≥ 90`). This tolerates PDF noise such as ligatures, hyphenation and whitespace but rejects paraphrase. It also fixes off-by-one page numbers and stores the character offsets, so the UI highlights the exact passage. Unverified quotes are shown with ⚠, never hidden.
- **Durable execution on DBOS, with Postgres as the only infrastructure.** `run_review` pages through pending items using a keyset cursor and enqueues one `process_document` workflow per document. Steps are checkpointed, so if the process is killed mid-run (tested with `kill -9`), it resumes on restart without redoing finished documents. Workflow IDs are deterministic per (review, run, doc), so a double start does nothing.
- **Errors are split by kind.**
  - Rate limits, timeouts and 5xx responses retry with exponential backoff (5 attempts).
  - Refusals, context overflow and output that is still invalid after the retry fail the row with a readable reason.
  - "Retry failed" starts a new run over just the failed rows.
- **Search runs in Postgres.** Metadata is indexed, and full text uses a GIN-indexed generated `tsvector`. Every filter compiles through a field/operator whitelist into parameterized SQL, including the filters the LLM produces.

## Scale (100k+ concurrent runs)

- **The real bottleneck is the model provider, not orchestration.** The DBOS queue caps concurrency per process (`EXTRACT_CONCURRENCY`) and enforces a **global rate limit shared by every worker** (`EXTRACT_RATE_PER_MIN`). That limit is what stops 100k runs from turning into a storm of 429 errors.
- **Scaling out is horizontal.** Run N workers against the same queue. Workflow inputs are IDs only, so document text is never checkpointed and payloads stay tiny. Enqueueing pages in batches of 500, so a 500k-document review never loads one giant list.
- **The UI handles large reviews.** The grid renders rows in windows. Progress, the ETA and token usage come from a single aggregate query.

## Rejected

| Option | Why not |
|---|---|
| Temporal | It is an extra cluster to run, and fanning one workflow out to 500k activities hits history limits, which forces child workflows or continue-as-new. DBOS gives the same durability plus queue rate limiting on the Postgres we already have. I'd revisit at ~10M workflows/day or multi-region. |
| Celery / SQS + workers | Durability, idempotency and resume-after-crash would all be hand-rolled. |
| One call per cell | It re-sends the document for every question, so cost scales with the number of columns. |
| RAG / chunking | Every seed document fits in context, and reading the whole document correctly answers "is X absent?", which retrieval can't. |
| Regenerating unverified quotes | It needs a second call plus merge logic. Flagging with ⚠ is honest and cheap. |

## Tradeoffs accepted

- **Each document is read on its own.** Questions that span documents ("contradicts the current spec?", "commitment met?") can only be answered from the one document. The grid says "not stated" honestly, but this is the biggest product gap.
- **Over-long documents fail** with "document too large" instead of being chunked.
- **Uploads keep extracted text only.** Parsing runs inside the request, pages are stored as JSONB in Postgres, and the original file is discarded. There is no OCR for scanned PDFs.
- **Short quotes can match by coincidence.** A minimum length is only a prompt instruction, not enforced in code.
- **The pre-run estimate is a heuristic**: ~1k tokens per document × question, not a real token count.
- **The UI polls every 2s** instead of receiving pushed updates, and the API and workers run in one process.

## With a week

1. **Reference documents per review.** Attach the current spec or the later correspondence to every prompt as a cached prefix, so cross-document questions get answered with citations from both sides.
2. **Human sign-off.** Accept or override a cell with an audit trail (who, when, why). Add grid filtering and sorting, such as "show unverified" and "show not found".
3. **Ingestion pipeline.** Store originals in S3 keyed by content hash and run parsing as its own workflow. Add OCR and DOCX support, and render the real PDF page with the quote highlighted.
4. **Long documents.** Per-column page retrieval followed by extraction, or map-reduce over chunks, keeping page-anchored citations.
5. **Cost and ops.**
   - Use the Batch API for non-urgent reviews (half the price).
   - Re-run a single row or column instead of the whole review.
   - Replace the heuristic estimate with real token counts.
   - Split the API and worker deployments, page the grid on the server, and push updates over SSE.
6. **Evals.** Build a labelled set per template that measures per-column precision and recall plus the quote verification rate, and run it on every prompt or model change.
