import csv
import io
from datetime import date

from backend.reviews.export import build_csv

REVIEW = {
    "columns": [
        {"key": "commitments", "label": "Commitments", "type": "list"},
        {"key": "met", "label": "Met?", "type": "boolean"},
    ],
    "items": [
        {
            "title": 'Letter, with "quotes"', "type": "ha_letter", "authority": "HC", "product": "BRX-101",
            "date": date(2021, 9, 14), "status": "done", "error": None,
            "answers": {
                "commitments": {"status": "found", "value": ["Submit data", "Tighten Q"],
                                "quotes": [{"text": 'commit, "now"', "page": 1, "verified": True},
                                           {"text": "b\n  c", "page": 2, "verified": False}]},
                "met": {"status": "not_found", "value": None, "quotes": []},
            },
        },
        {"title": "Failed doc", "type": "ha_letter", "authority": "FDA", "product": None, "date": None,
         "status": "failed", "error": "document too large", "answers": None},
        {"title": "Queued doc", "type": "ha_letter", "authority": "EMA", "product": None, "date": None,
         "status": "queued", "error": None, "answers": None},
    ],
}


def _rows():
    text = build_csv(REVIEW)
    assert text.startswith("﻿")
    return list(csv.reader(io.StringIO(text[1:])))


def test_headers_and_one_row_per_document():
    rows = _rows()
    assert rows[0] == ["Document", "Type", "Authority", "Product", "Date", "Status",
                       "Commitments", "Commitments — evidence", "Met?", "Met? — evidence"]
    assert len(rows) == 4


def test_cells():
    _, done, failed, queued = _rows()
    assert done[0] == 'Letter, with "quotes"'
    assert done[6] == "Submit data; Tighten Q"
    assert done[7] == 'p.1: "commit, "now"" | p.2: "b c" [unverified]'
    assert done[8:] == ["Not found", ""]
    assert failed[6] == "Failed: document too large"
    assert queued[6] == "Pending"
