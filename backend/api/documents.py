"""Document routes: upload, search, plain-English filters, fetch one."""

from datetime import date
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import ValidationError

from backend import db, llm
from backend.api.errors import not_found
from backend.config import settings
from backend.documents.filter_from_text import FilterFromTextError, filter_from_text
from backend.documents.filters import FilterError, to_sql
from backend.documents.parse import ParseError, file_ext, parse
from backend.models import DocumentMeta, FilterFromTextRequest, SearchRequest

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload")
async def upload_documents(
    files: Annotated[list[UploadFile], File()],
    type: Annotated[str, Form()],
    authority: Annotated[str, Form()],
    product: Annotated[str | None, Form()] = None,
    doc_date: Annotated[date | None, Form(alias="date")] = None,
):
    try:
        meta = DocumentMeta(type=type, authority=authority, product=product or None, date=doc_date)
    except ValidationError as e:
        raise HTTPException(400, e.errors()[0]["msg"])

    created, errors = [], []
    for f in files:
        data = await f.read()
        if len(data) > settings().max_upload_bytes:
            errors.append({"filename": f.filename, "error": "file larger than 25MB"})
            continue
        try:
            pages = parse(f.filename, data)
        except ParseError as e:
            errors.append({"filename": f.filename, "error": str(e)})
            continue
        created.append(
            db.insert_document(
                title=Path(f.filename).stem.replace("_", " "), filename=f.filename, file_ext=file_ext(f.filename),
                type=meta.type, authority=meta.authority, product=meta.product, date=meta.date, pages=pages,
            )
        )
    if not created:
        raise HTTPException(400, {"message": "no files uploaded", "errors": errors})
    return {"documents": created, "errors": errors}


@router.get("/facets")
def get_facets():
    return db.facets()


@router.post("/search")
def search_documents(req: SearchRequest):
    try:
        where, params = to_sql(req.filter)
    except FilterError as e:
        raise HTTPException(400, str(e))
    rows, total = db.search_documents(where, params, req.limit, req.offset)
    return {"documents": rows, "total": total}


@router.post("/filter-from-text")
def documents_filter_from_text(req: FilterFromTextRequest):
    try:
        return filter_from_text(req.text)
    except (FilterFromTextError, llm.PermanentLLMError) as e:
        raise HTTPException(422, str(e))


@router.get("/{doc_id}")
def get_document(doc_id: UUID):
    doc = db.get_document(str(doc_id))
    if doc is None:
        raise not_found("document")
    return doc
