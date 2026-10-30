"""Review routes: preview, create, run, retry, read, export."""

import re
from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from backend import db, llm
from backend.api.errors import not_found
from backend.documents.filters import FilterError, to_sql
from backend.extraction.extract import extract, verify_answers
from backend.models import CreateReviewRequest, PreviewRequest
from backend.reviews import workflows
from backend.reviews.export import build_csv

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/preview")
def preview_review(req: PreviewRequest):
    """Run the questions on one document synchronously, to check wording before a bulk run."""
    try:
        pages = db.get_pages(req.document_id)
    except LookupError:
        raise not_found("document")
    try:
        answers, usage = extract(pages, req.columns)
    except llm.PermanentLLMError as e:
        raise HTTPException(422, str(e))
    except llm.RETRYABLE:
        raise HTTPException(503, "Model is busy, try again in a moment")
    answers = verify_answers(answers, pages)
    return {
        "answers": {k: a.model_dump() for k, a in answers.items()},
        "tokens_in": usage.input_tokens,
        "tokens_out": usage.output_tokens,
    }


@router.post("")
def create_review(req: CreateReviewRequest):
    try:
        to_sql(req.filter)
        review = db.create_review(
            req.name, req.filter.model_dump(), [c.model_dump() for c in req.columns], req.document_ids
        )
    except (FilterError, ValueError) as e:
        raise HTTPException(400, str(e))
    return db.get_review(str(review["id"]))


@router.post("/{review_id}/run")
def run_review(review_id: UUID):
    review = db.get_review(str(review_id))
    if review is None:
        raise not_found("review")
    if review["status"] == "draft":
        workflows.start_review(str(review_id), db.start_review_run(str(review_id), requeue_failed=False))
    return db.get_review(str(review_id))


@router.post("/{review_id}/retry-failed")
def retry_failed(review_id: UUID):
    review = db.get_review(str(review_id))
    if review is None:
        raise not_found("review")
    if review["status"] == "running":
        raise HTTPException(409, "review is still running")
    if review["failed"] == 0:
        raise HTTPException(400, "no failed documents to retry")
    workflows.start_review(str(review_id), db.start_review_run(str(review_id), requeue_failed=True))
    return db.get_review(str(review_id))


@router.get("")
def list_reviews():
    return db.list_reviews()


@router.get("/{review_id}")
def get_review(review_id: UUID):
    review = db.get_review(str(review_id))
    if review is None:
        raise not_found("review")
    return review


@router.get("/{review_id}/export.csv")
def export_review(review_id: UUID):
    review = db.get_review(str(review_id))
    if review is None:
        raise not_found("review")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", review["name"]).strip("-").lower() or "review"
    filename = f"{slug}-{date.today().isoformat()}.csv"
    return Response(
        build_csv(review),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
