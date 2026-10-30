"""Review → CSV. One row per document; an answer and an evidence column per question."""

import csv
import io

META_HEADERS = ["Document", "Type", "Authority", "Product", "Date", "Status"]


def _format_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, list):
        return "; ".join(str(v) for v in value)
    return str(value)


def _format_evidence(quotes: list[dict]) -> str:
    return " | ".join(
        f'p.{q["page"]}: "{" ".join(q["text"].split())}"' + ("" if q.get("verified") else " [unverified]") for q in quotes
    )


def _answer_cells(item: dict, key: str) -> tuple[str, str]:
    if item["status"] == "failed":
        return f"Failed: {item['error'] or 'unknown error'}", ""
    if item["status"] != "done" or not item["answers"]:
        return "Pending", ""
    answer = item["answers"].get(key)
    if not answer or answer["status"] == "not_found":
        return "Not found", ""
    return _format_value(answer["value"]), _format_evidence(answer["quotes"])


def build_csv(review: dict) -> str:
    columns = review["columns"]
    buf = io.StringIO()
    buf.write("﻿")  # BOM so Excel detects UTF-8
    writer = csv.writer(buf)
    headers = list(META_HEADERS)
    for c in columns:
        headers += [c["label"], f"{c['label']} — evidence"]
    writer.writerow(headers)
    for item in review["items"]:
        row = [
            item["title"], item["type"], item["authority"], item["product"] or "",
            item["date"].isoformat() if item["date"] else "", item["status"],
        ]
        for c in columns:
            row += _answer_cells(item, c["key"])
        writer.writerow(row)
    return buf.getvalue()
