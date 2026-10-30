from backend.extraction.extract import build_schema, validate
from backend.models import Column

COLUMNS = [
    Column(key="a", label="A", question="?", type="text"),
    Column(key="b", label="B", question="?", type="list"),
    Column(key="c", label="C", question="?", type="enum", options=["x", "y"]),
    Column(key="d", label="D", question="?", type="boolean"),
]


def _walk(node):
    if isinstance(node, dict):
        if node.get("type") == "object" or node.get("type") == ["object", "null"]:
            yield node
        for v in node.values():
            yield from _walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from _walk(v)


def test_strict_mode_rules():
    schema = build_schema(COLUMNS)
    objects = list(_walk(schema))
    assert len(objects) >= 1 + 2 * len(COLUMNS)
    for obj in objects:
        assert obj["additionalProperties"] is False
        assert set(obj["required"]) == set(obj["properties"])


def test_quotes_before_value():
    props = build_schema(COLUMNS)["properties"]["a"]["properties"]
    assert list(props) == ["status", "quotes", "value"]


def test_enum_allows_null():
    assert build_schema(COLUMNS)["properties"]["c"]["properties"]["value"]["enum"] == ["x", "y", None]


def test_validate_clears_not_found_and_checks_pages():
    raw = {
        "a": {"status": "not_found", "quotes": [{"text": "junk", "page": 1}], "value": "junk"},
        "b": {"status": "found", "quotes": [{"text": "q", "page": 2}], "value": ["v"]},
        "c": {"status": "found", "quotes": [], "value": "x"},
        "d": {"status": "found", "quotes": [], "value": True},
    }
    answers = validate(raw, COLUMNS, page_count=2)
    assert answers["a"].value is None and answers["a"].quotes == []
    raw["b"]["quotes"][0]["page"] = 5
    try:
        validate(raw, COLUMNS, page_count=2)
        raise AssertionError("expected page range error")
    except ValueError as e:
        assert "page 5" in str(e)
