"""Pydantic types shared by the API, extraction, and export."""

import datetime as dt
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

DocType = Literal[
    "ha_letter", "stability_protocol", "cmc_section", "csr", "protocol", "sop", "deviation", "other"
]
Authority = Literal["FDA", "EMA", "HC", "PMDA", "MHRA", "other", "none"]
ColumnType = Literal["text", "date", "number", "boolean", "enum", "list"]


# --- Filters -----------------------------------------------------------------

class Condition(BaseModel):
    field: str
    operator: str
    value: Any


class Filter(BaseModel):
    """A flat list of conditions, all ANDed together."""

    conditions: list[Condition] = []


# --- Review columns and answers ----------------------------------------------

class Column(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{0,39}$")
    label: str
    question: str
    type: ColumnType = "text"
    options: list[str] | None = None

    @model_validator(mode="after")
    def _enum_needs_options(self) -> "Column":
        if self.type == "enum" and not self.options:
            raise ValueError(f"column '{self.key}' is enum but has no options")
        return self


class Quote(BaseModel):
    text: str
    page: int
    verified: bool = False
    score: float = 0.0
    start: int | None = None  # char offsets of the match in the page's text
    end: int | None = None


class Answer(BaseModel):
    status: Literal["found", "not_found"]
    value: Any = None
    quotes: list[Quote] = []


# --- Requests ----------------------------------------------------------------

class SearchRequest(BaseModel):
    filter: Filter
    limit: int = Field(default=200, le=1000)
    offset: int = 0


class FilterFromTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class CreateReviewRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    filter: Filter
    document_ids: list[str] = Field(min_length=1)
    columns: list[Column] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def _unique_keys(self) -> "CreateReviewRequest":
        keys = [c.key for c in self.columns]
        if len(keys) != len(set(keys)):
            raise ValueError("column keys must be unique")
        return self


class PreviewRequest(BaseModel):
    document_id: str
    columns: list[Column] = Field(min_length=1, max_length=30)


class DocumentMeta(BaseModel):
    type: DocType
    authority: Authority
    product: str | None = None
    date: dt.date | None = None
