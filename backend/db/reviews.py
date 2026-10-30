"""Review and review-item queries."""

from psycopg.types.json import Jsonb

from backend.db.connection import execute, fetch_all, fetch_one, pool

_PROGRESS = """
    count(i.*) AS total,
    count(i.*) FILTER (WHERE i.status = 'done') AS done,
    count(i.*) FILTER (WHERE i.status = 'failed') AS failed,
    count(i.*) FILTER (WHERE i.status = 'running') AS running,
    count(i.*) FILTER (WHERE i.status = 'queued') AS queued,
    coalesce(sum(i.tokens_in), 0) AS tokens_in,
    coalesce(sum(i.tokens_out), 0) AS tokens_out,
    count(i.*) FILTER (WHERE i.finished_at >= r.started_at) AS finished_this_run
"""


def create_review(name: str, filter: dict, columns: list[dict], document_ids: list[str]) -> dict:
    with pool().connection() as conn, conn.transaction():
        review = conn.execute(
            "INSERT INTO reviews (name, filter, columns) VALUES (%s, %s, %s) RETURNING *",
            (name, Jsonb(filter), Jsonb(columns)),
        ).fetchone()
        inserted = conn.execute(
            """INSERT INTO review_items (review_id, document_id)
               SELECT %s, id FROM documents WHERE id = ANY(%s::uuid[])
               RETURNING document_id""",
            (review["id"], document_ids),
        ).fetchall()
        if not inserted:
            raise ValueError("none of the document ids exist")
    return review


def list_reviews() -> list[dict]:
    return fetch_all(
        f"""SELECT r.id, r.name, r.status, r.created_at, jsonb_array_length(r.columns) AS column_count, {_PROGRESS}
            FROM reviews r LEFT JOIN review_items i ON i.review_id = r.id
            GROUP BY r.id ORDER BY r.created_at DESC"""
    )


def get_review(review_id: str) -> dict | None:
    review = fetch_one(
        f"""SELECT r.*, {_PROGRESS}
            FROM reviews r LEFT JOIN review_items i ON i.review_id = r.id
            WHERE r.id = %s GROUP BY r.id""",
        (review_id,),
    )
    if review is None:
        return None
    review["items"] = fetch_all(
        """SELECT i.document_id, i.status, i.answers, i.error, i.tokens_in, i.tokens_out,
                  d.title, d.type, d.authority, d.product, d.date, d.page_count
           FROM review_items i JOIN documents d ON d.id = i.document_id
           WHERE i.review_id = %s ORDER BY d.date DESC NULLS LAST, d.title""",
        (review_id,),
    )
    return review


def get_review_columns(review_id: str) -> list[dict]:
    row = fetch_one("SELECT columns FROM reviews WHERE id = %s", (review_id,))
    if row is None:
        raise LookupError(f"review {review_id} not found")
    return row["columns"]


def set_review_status(review_id: str, status: str) -> None:
    execute("UPDATE reviews SET status = %s WHERE id = %s", (status, review_id))


def start_review_run(review_id: str, requeue_failed: bool) -> int:
    """Mark the review running and return the new run number."""
    with pool().connection() as conn, conn.transaction():
        if requeue_failed:
            conn.execute(
                "UPDATE review_items SET status = 'queued', error = NULL WHERE review_id = %s AND status = 'failed'",
                (review_id,),
            )
        row = conn.execute(
            "UPDATE reviews SET status = 'running', runs = runs + 1, started_at = now() WHERE id = %s RETURNING runs", (review_id,)
        ).fetchone()
    return row["runs"]


def pending_document_ids(review_id: str, after: str | None, limit: int) -> list[str]:
    """Page through unfinished items by document_id (keyset pagination)."""
    rows = fetch_all(
        """SELECT document_id::text AS id FROM review_items
           WHERE review_id = %s AND status IN ('queued', 'running')
             AND (%s::uuid IS NULL OR document_id > %s::uuid)
           ORDER BY document_id LIMIT %s""",
        (review_id, after, after, limit),
    )
    return [r["id"] for r in rows]


def set_item_running(review_id: str, document_id: str) -> None:
    execute(
        "UPDATE review_items SET status = 'running', error = NULL WHERE review_id = %s AND document_id = %s",
        (review_id, document_id),
    )


def save_item_done(review_id: str, document_id: str, answers_json: str, tokens_in: int, tokens_out: int) -> None:
    execute(
        """UPDATE review_items SET status = 'done', answers = %s::jsonb, error = NULL, tokens_in = %s, tokens_out = %s,
               finished_at = now()
           WHERE review_id = %s AND document_id = %s""",
        (answers_json, tokens_in, tokens_out, review_id, document_id),
    )


def save_item_failed(review_id: str, document_id: str, error: str) -> None:
    execute(
        "UPDATE review_items SET status = 'failed', error = %s, finished_at = now() WHERE review_id = %s AND document_id = %s",
        (error[:1000], review_id, document_id),
    )
