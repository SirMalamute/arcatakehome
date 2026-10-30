"""Data access. `from backend import db` exposes every query; the submodules group them by table."""

from backend.db.connection import execute, fetch_all, fetch_one, init_schema, pool
from backend.db.documents import (
    document_exists,
    facets,
    get_document,
    get_pages,
    insert_document,
    search_documents,
)
from backend.db.reviews import (
    create_review,
    get_review,
    get_review_columns,
    list_reviews,
    pending_document_ids,
    save_item_done,
    save_item_failed,
    set_item_running,
    set_review_status,
    start_review_run,
)
