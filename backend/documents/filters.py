"""Filter → parameterized SQL.

Every field and operator goes through a whitelist; values are always bound as
parameters, never interpolated into the SQL string.
"""

from dataclasses import dataclass
from datetime import date
from typing import Any, Callable

from backend.models import Condition, Filter


class FilterError(ValueError):
    pass


@dataclass(frozen=True)
class Op:
    value_kind: str  # "str" | "str_list" | "date" | "date_range"
    build: Callable[[str, Any], tuple[str, list]]


def _eq(col: str, v: str) -> tuple[str, list]:
    return f"{col} = %s", [v]


def _in(col: str, v: list[str]) -> tuple[str, list]:
    return f"{col} = ANY(%s)", [v]


def _ts_combine(joiner: str) -> Callable[[str, list[str]], tuple[str, list]]:
    def build(col: str, words: list[str]) -> tuple[str, list]:
        parts = " {} ".format(joiner).join(["plainto_tsquery('english', %s)"] * len(words))
        return f"{col} @@ ({parts})", list(words)

    return build


ENUM_OPS = {"is": Op("str", _eq), "in": Op("str_list", _in)}

FIELDS: dict[str, tuple[str, dict[str, Op]]] = {
    "type": ("type", ENUM_OPS),
    "authority": ("authority", ENUM_OPS),
    "product": ("product", ENUM_OPS),
    "date": (
        "date",
        {
            "before": Op("date", lambda c, v: (f"{c} < %s", [v])),
            "after": Op("date", lambda c, v: (f"{c} > %s", [v])),
            "between": Op("date_range", lambda c, v: (f"{c} BETWEEN %s AND %s", [v["from"], v["to"]])),
        },
    ),
    "text": (
        "search",
        {
            "contains_all": Op("str_list", _ts_combine("&&")),
            "contains_any": Op("str_list", _ts_combine("||")),
            "contains_phrase": Op("str", lambda c, v: (f"{c} @@ phraseto_tsquery('english', %s)", [v])),
        },
    ),
}


def _parse_date(v: Any, where: str) -> date:
    try:
        return date.fromisoformat(str(v))
    except ValueError:
        raise FilterError(f"{where}: expected an ISO date (YYYY-MM-DD), got {v!r}")


def _check_value(kind: str, v: Any, where: str) -> Any:
    match kind:
        case "str":
            if not isinstance(v, str) or not v.strip():
                raise FilterError(f"{where}: expected a non-empty string")
            return v.strip()
        case "str_list":
            if not isinstance(v, list) or not v or not all(isinstance(x, str) and x.strip() for x in v):
                raise FilterError(f"{where}: expected a non-empty list of strings")
            return [x.strip() for x in v]
        case "date":
            return _parse_date(v, where)
        case "date_range":
            if not isinstance(v, dict) or "from" not in v or "to" not in v:
                raise FilterError(f"{where}: expected {{from, to}}")
            return {"from": _parse_date(v["from"], where), "to": _parse_date(v["to"], where)}
    raise AssertionError(kind)


def validate_condition(cond: Condition) -> tuple[str, list]:
    if cond.field not in FIELDS:
        raise FilterError(f"unknown field '{cond.field}' (allowed: {', '.join(FIELDS)})")
    column, ops = FIELDS[cond.field]
    if cond.operator not in ops:
        raise FilterError(
            f"operator '{cond.operator}' not allowed for '{cond.field}' (allowed: {', '.join(ops)})"
        )
    op = ops[cond.operator]
    value = _check_value(op.value_kind, cond.value, f"{cond.field} {cond.operator}")
    return op.build(column, value)


def to_sql(f: Filter) -> tuple[str, list]:
    """Return (where_sql, params). An empty filter matches every document."""
    if not f.conditions:
        return "TRUE", []
    clauses, params = [], []
    for cond in f.conditions:
        sql, p = validate_condition(cond)
        clauses.append(f"({sql})")
        params.extend(p)
    return " AND ".join(clauses), params
