"""Postgres connection pool and query helpers."""

from functools import lru_cache
from pathlib import Path
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from backend.config import settings


@lru_cache
def pool() -> ConnectionPool:
    return ConnectionPool(
        settings().database_url, min_size=1, max_size=20, kwargs={"row_factory": dict_row}, open=True
    )


def fetch_all(sql: str, params: list | tuple = ()) -> list[dict[str, Any]]:
    with pool().connection() as conn:
        return conn.execute(sql, params).fetchall()


def fetch_one(sql: str, params: list | tuple = ()) -> dict[str, Any] | None:
    with pool().connection() as conn:
        return conn.execute(sql, params).fetchone()


def execute(sql: str, params: list | tuple = ()) -> None:
    with pool().connection() as conn:
        conn.execute(sql, params)


def init_schema() -> None:
    with pool().connection() as conn:
        conn.execute((Path(__file__).parent / "schema.sql").read_text())
