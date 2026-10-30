"""Plain English → Filter. Never runs the search; the user reviews the filter first."""

from datetime import date

from pydantic import ValidationError

from backend import db, llm
from backend.config import settings
from backend.documents.filters import FIELDS, FilterError, validate_condition
from backend.models import Condition, Filter


class FilterFromTextError(ValueError):
    pass


_VALUE_SCHEMA = {
    "anyOf": [
        {"type": "string"},
        {"type": "array", "items": {"type": "string"}},
        {
            "type": "object",
            "properties": {"from": {"type": "string"}, "to": {"type": "string"}},
            "required": ["from", "to"],
            "additionalProperties": False,
        },
    ]
}

SCHEMA = {
    "type": "object",
    "properties": {
        "conditions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "field": {"type": "string", "enum": list(FIELDS)},
                    "operator": {"type": "string"},
                    "value": _VALUE_SCHEMA,
                },
                "required": ["field", "operator", "value"],
                "additionalProperties": False,
            },
        },
        "explanation": {"type": "string"},
    },
    "required": ["conditions", "explanation"],
    "additionalProperties": False,
}

FIELD_DOCS = """Fields and operators (all conditions are ANDed):
- type: is (string) | in (list). Values: ha_letter, stability_protocol, cmc_section, csr, protocol, sop, deviation, other
- authority: is | in. Values: FDA, EMA, HC (Health Canada), PMDA, MHRA, other, none
- product: is | in
- date (document date): before | after (YYYY-MM-DD) | between ({from, to})
- text (document body, full-text search): contains_all (list of words) | contains_any (list of words) | contains_phrase (string)"""


def _system_prompt() -> str:
    f = db.facets()
    return f"""Turn a request for a set of regulatory documents into search filters.

Today is {date.today().isoformat()}.

{FIELD_DOCS}

Values present in the database:
- types: {", ".join(f["types"]) or "none"}
- authorities: {", ".join(f["authorities"]) or "none"}
- products: {", ".join(f["products"]) or "none"}
- date range: {f["min_date"]} to {f["max_date"]}

Rules:
- Use only the fields and operators above, and real values from the database where possible.
- "Before 2024" means date before 2024-01-01; "in 2023" means between 2023-01-01 and 2023-12-31.
- Topic words ("mentioning stability") go in a text condition; keep them to single significant words.
- explanation: one plain-English sentence describing the filter."""


def filter_from_text(text: str) -> dict:
    system = _system_prompt()
    user, last_error = text, ""
    for _ in range(2):
        prompt = user if not last_error else f"{user}\n\nYour previous filter was invalid: {last_error}"
        raw, _ = llm.structured_call(settings().filter_model, system, prompt, "document_filter", SCHEMA)
        try:
            f = Filter(conditions=[Condition.model_validate(c) for c in raw["conditions"]])
            for c in f.conditions:
                validate_condition(c)
            return {"filter": f.model_dump(), "explanation": raw["explanation"]}
        except (ValidationError, FilterError) as e:
            last_error = str(e)
    raise FilterFromTextError("Couldn't turn that into filters — try advanced search")
