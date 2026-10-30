"""Answer a set of questions (columns) about one document, with quotes."""

import json

from pydantic import ValidationError

from backend import llm
from backend.config import settings
from backend.extraction.verify import verify
from backend.models import Answer, Column

SYSTEM = """You are a regulatory affairs analyst extracting facts from pharmaceutical documents.

The document is given with [[PAGE n]] markers. Answer every question.

Rules:
- Base every answer only on the document. Never guess or use outside knowledge.
- For each found answer, give 1-2 supporting quotes. Each quote must be copied exactly, character for character, from the document text and be at least one full sentence (or a full table row). Do not shorten, paraphrase, or stitch together text from different places.
- Give the page number from the [[PAGE n]] marker that precedes the quoted text.
- Order matters: pick the quotes first, then derive the value from them.
- If the document does not answer the question, use status "not_found", value null, and an empty quotes list.
- Dates: ISO format YYYY-MM-DD (YYYY-MM if the day is not stated).
- Lists: one item per distinct entry, each a short self-contained phrase."""

_VALUE_SCHEMAS: dict[str, dict] = {
    "text": {"type": ["string", "null"]},
    "date": {"type": ["string", "null"]},
    "number": {"type": ["number", "null"]},
    "boolean": {"type": ["boolean", "null"]},
    "list": {"type": ["array", "null"], "items": {"type": "string"}},
}

_QUOTE_SCHEMA = {
    "type": "object",
    "properties": {"text": {"type": "string"}, "page": {"type": "integer"}},
    "required": ["text", "page"],
    "additionalProperties": False,
}


def _value_schema(col: Column) -> dict:
    if col.type == "enum":
        return {"type": ["string", "null"], "enum": [*col.options, None]}
    return _VALUE_SCHEMAS[col.type]


def build_schema(columns: list[Column]) -> dict:
    """Strict-mode schema: every property required, no additional properties.

    `quotes` precedes `value` so the model commits to evidence before answering.
    """
    props = {
        c.key: {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["found", "not_found"]},
                "quotes": {"type": "array", "items": _QUOTE_SCHEMA},
                "value": _value_schema(c),
            },
            "required": ["status", "quotes", "value"],
            "additionalProperties": False,
        }
        for c in columns
    }
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


def render_document(pages: list[str]) -> str:
    return "\n\n".join(f"[[PAGE {i}]]\n{p}" for i, p in enumerate(pages, start=1))


def build_user_message(pages: list[str], columns: list[Column]) -> str:
    # Document first, questions last: the stable prefix benefits from prompt caching.
    questions = "\n".join(
        f"- {c.key} ({c.type}{': one of ' + ', '.join(c.options) if c.options else ''}): {c.question}"
        for c in columns
    )
    return f"<document>\n{render_document(pages)}\n</document>\n\nQuestions:\n{questions}"


def validate(raw: dict, columns: list[Column], page_count: int) -> dict[str, Answer]:
    answers: dict[str, Answer] = {}
    for c in columns:
        a = Answer.model_validate(raw[c.key])
        if a.status == "not_found":
            a = Answer(status="not_found")
        for q in a.quotes:
            if not 1 <= q.page <= page_count:
                raise ValueError(f"{c.key}: quote cites page {q.page}, document has {page_count} pages")
        answers[c.key] = a
    return answers


def extract(pages: list[str], columns: list[Column]) -> tuple[dict[str, Answer], llm.Usage]:
    """One structured call; on invalid output retry once with the error appended."""
    schema = build_schema(columns)
    user = build_user_message(pages, columns)
    usage = llm.Usage()
    last_error = ""
    for _ in range(2):
        prompt = user if not last_error else f"{user}\n\nYour previous answer was invalid: {last_error}\nFix it."
        raw, u = llm.structured_call(settings().extract_model, SYSTEM, prompt, "document_answers", schema)
        usage += u
        try:
            return validate(raw, columns, len(pages)), usage
        except (ValidationError, ValueError, KeyError) as e:
            last_error = str(e)[:500]
    raise llm.PermanentLLMError(f"invalid model output after retry: {last_error}")


def verify_answers(answers: dict[str, Answer], pages: list[str]) -> dict[str, Answer]:
    """Fuzzy-match each quote against the pages; correct page numbers; flag misses."""
    for a in answers.values():
        for q in a.quotes:
            result = verify(q.text, pages)
            q.verified, q.score = result["verified"], result["score"]
            if result["verified"]:
                q.page, q.start, q.end = result["page"], result["start"], result["end"]
    return answers


def answers_to_json(answers: dict[str, Answer]) -> str:
    return json.dumps({k: a.model_dump() for k, a in answers.items()})
