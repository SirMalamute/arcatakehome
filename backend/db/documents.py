"""Document queries."""

from typing import Any

from psycopg.types.json import Jsonb

from backend.db.connection import fetch_all, fetch_one

DOC_LIST_COLUMNS = "id, title, filename, file_ext, type, authority, product, date, page_count, created_at"


def insert_document(
    *, title: str, filename: str, file_ext: str, type: str, authority: str,
    product: str | None, date: Any, pages: list[str],
) -> dict:
    return fetch_one(
        f"""INSERT INTO documents (title, filename, file_ext, type, authority, product, date, pages, page_count, full_text)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING {DOC_LIST_COLUMNS}""",
        (title, filename, file_ext, type, authority, product, date, Jsonb(pages), len(pages), "\n\n".join(pages)),
    )


def document_exists(filename: str) -> bool:
    return fetch_one("SELECT 1 FROM documents WHERE filename = %s", (filename,)) is not None


def facets() -> dict:
    row = fetch_one(
        """SELECT
             coalesce(array_agg(DISTINCT type) FILTER (WHERE type IS NOT NULL), '{}') AS types,
             coalesce(array_agg(DISTINCT authority) FILTER (WHERE authority IS NOT NULL), '{}') AS authorities,
             coalesce(array_agg(DISTINCT product) FILTER (WHERE product IS NOT NULL), '{}') AS products,
             min(date) AS min_date, max(date) AS max_date,
             count(*) AS total
           FROM documents"""
    )
    return {k: sorted(v) if isinstance(v, list) else v for k, v in row.items()}


def search_documents(where: str, params: list, limit: int, offset: int) -> tuple[list[dict], int]:
    rows = fetch_all(
        f"""SELECT {DOC_LIST_COLUMNS}, count(*) OVER () AS total
            FROM documents WHERE {where}
            ORDER BY date DESC NULLS LAST, title LIMIT %s OFFSET %s""",
        [*params, limit, offset],
    )
    total = rows[0].pop("total") if rows else 0
    for r in rows[1:]:
        r.pop("total")
    return rows, total


def get_document(doc_id: str) -> dict | None:
    return fetch_one(f"SELECT {DOC_LIST_COLUMNS}, pages FROM documents WHERE id = %s", (doc_id,))


def get_pages(doc_id: str) -> list[str]:
    row = fetch_one("SELECT pages FROM documents WHERE id = %s", (doc_id,))
    if row is None:
        raise LookupError(f"document {doc_id} not found")
    return row["pages"]
