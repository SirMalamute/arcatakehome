import pytest

from backend.documents.filters import FilterError, to_sql
from backend.models import Filter


def f(*conds):
    return Filter.model_validate({"conditions": [dict(field=a, operator=b, value=c) for a, b, c in conds]})


def test_empty_filter_matches_all():
    assert to_sql(Filter()) == ("TRUE", [])


@pytest.mark.parametrize(
    "field,op,value,sql_part,params",
    [
        ("type", "is", "ha_letter", "type = %s", ["ha_letter"]),
        ("authority", "in", ["FDA", "HC"], "authority = ANY(%s)", [["FDA", "HC"]]),
        ("product", "is", "BRX-101", "product = %s", ["BRX-101"]),
        ("text", "contains_phrase", "shelf life", "phraseto_tsquery", ["shelf life"]),
        ("text", "contains_all", ["stability", "excipient"], "&&", ["stability", "excipient"]),
        ("text", "contains_any", ["stability", "excipient"], "||", ["stability", "excipient"]),
    ],
)
def test_operators(field, op, value, sql_part, params):
    sql, p = to_sql(f((field, op, value)))
    assert sql_part in sql
    assert p == params


def test_dates():
    sql, p = to_sql(f(("date", "before", "2024-01-01"), ("date", "between", {"from": "2020-01-01", "to": "2021-01-01"})))
    assert sql == "(date < %s) AND (date BETWEEN %s AND %s)"
    assert [str(x) for x in p] == ["2024-01-01", "2020-01-01", "2021-01-01"]


def test_values_never_interpolated():
    evil = "x'; DROP TABLE documents; --"
    sql, p = to_sql(f(("product", "is", evil)))
    assert evil not in sql and p == [evil]


@pytest.mark.parametrize(
    "cond,msg",
    [
        (("title", "is", "x"), "unknown field"),
        (("type", "contains", "x"), "not allowed"),
        (("type", "in", "ha_letter"), "list of strings"),
        (("date", "before", "last year"), "ISO date"),
        (("date", "between", {"from": "2020-01-01"}), "from, to"),
        (("text", "contains_all", []), "non-empty list"),
    ],
)
def test_rejects_invalid(cond, msg):
    with pytest.raises(FilterError, match=msg):
        to_sql(f(cond))
