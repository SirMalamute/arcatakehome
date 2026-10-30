"""Load data/documents/* into Postgres using the manifest. Idempotent by filename."""

import json
from pathlib import Path

from backend import db
from backend.documents.parse import file_ext, parse

DOCS_DIR = Path(__file__).parent.parent / "data" / "documents"


def main() -> None:
    db.init_schema()
    manifest = json.loads((DOCS_DIR / "manifest.json").read_text())
    added = 0
    for filename, meta in manifest.items():
        if db.document_exists(filename):
            continue
        pages = parse(filename, (DOCS_DIR / filename).read_bytes())
        db.insert_document(
            title=meta["title"], filename=filename, file_ext=file_ext(filename), type=meta["type"],
            authority=meta["authority"], product=meta["product"], date=meta["date"], pages=pages,
        )
        added += 1
    print(f"seeded {added} documents ({len(manifest) - added} already present)")


if __name__ == "__main__":
    main()
