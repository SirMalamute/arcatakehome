# Arca Reviewer

Bulk review for regulatory documents. You pick a set of documents, ask questions as columns, and an LLM answers every question for every document. Each answer comes with verbatim quotes and page numbers, and every quote is checked against the source. The design and its tradeoffs are covered in [SUMMARY.md](SUMMARY.md), and the path to large scale in [SCALING.md](SCALING.md).

## Run

Prereqs: Docker, [uv](https://docs.astral.sh/uv/), Node 20+, and an OpenAI API key.

```bash
cp .env.example .env                           # set OPENAI_API_KEY
docker compose up -d --wait                    # Postgres 16 on localhost:5433
uv sync
uv run python -m backend.seed                  # loads 22 seed docs (19 md + 3 multi-page PDFs)
uv run uvicorn backend.main:app --port 8000    # API + DBOS workers in one process
cd frontend && npm install && npm run dev      # http://localhost:5173
```

Optional settings in `.env`:
- `EXTRACT_MODEL` defaults to `gpt-5`.
- `FILTER_MODEL` defaults to `gpt-5-mini`.
- `EXTRACT_CONCURRENCY` caps extractions per process (default 10).
- `EXTRACT_RATE_PER_MIN` caps extraction starts per minute across all workers (default 300).

## Test

**Unit tests:** `uv run pytest`. They cover filter → SQL, the extraction schema, quote verification and offsets, and CSV export.

**Manual walkthrough:**
1. **Find documents.** On the Documents page, type into Describe: *"Health Canada letters before 2024 mentioning stability"*. Editable filter chips appear and the result list narrows. Change one condition by hand.
2. **Upload.** Upload a PDF along with its type, authority, product and date. It shows up in search with its page count.
3. **Create a review.** From Reviews, pick the *Health authority commitments* quick start.
   - Step 1 selects the HA letters.
   - Step 2 loads the template's columns.
   - Click **Preview** to see the answers for one document, check the estimate, then click **Run on N documents**.
4. **Watch it run.** Rows fill in live, with progress and an ETA.
5. **Check the evidence.** Click a cell. The evidence pane shows the answer and each quote, with its page, a verified or ⚠ mark, and the passage highlighted in the source. Arrow keys move between cells, J/K step through rows, and Esc closes the pane.
6. **Crash recovery.** Kill the API process mid-run (`kill -9`) and restart it. DBOS resumes the in-flight documents, and finished ones are not redone.
7. **Export.** Click **Export CSV**. Each question gets an answer column and an evidence column, and the file opens cleanly in Excel.

## Features

- **Document selection.**
  - Plain English → filters with a short explanation, applied as the same filters you can edit.
  - A filter builder over type, authority, product, date (before, after, between) and full text (all words, any word, exact phrase).
  - Paged results.
- **Upload.** PDF, TXT and MD files with metadata, parsed per page. Errors are reported per file.
- **Questions as typed columns.** Text, list, date, number, yes/no, or one-of. There are three templates: CMC excipients, HA commitments and stability protocol.
- **Preview and estimate.** Preview runs the questions on one document before committing. The token, cost and time estimate is a rough heuristic.
- **Durable runs on DBOS.**
  - Each document is checkpointed, so a run survives a crash.
  - A global rate limit and per-process concurrency cap keep the model provider from being overloaded.
  - Transient errors retry with backoff, and permanent failures record a reason.
  - "Retry failed" re-runs only the failed rows.
- **Verified citations.** Quotes are fuzzy-matched (rapidfuzz ≥ 90) against the parsed text. Page numbers are corrected and character offsets are stored, so the exact passage gets highlighted.
- **Results grid.**
  - Updates live, with progress, ETA, token usage and a failure banner.
  - A resizable evidence pane with keyboard navigation.
  - Copy a quote with its citation, or copy a deep link to a cell.
  - The URL keeps the selected row and column.
- **CSV export** with answer and evidence columns, UTF-8 with a BOM so Excel reads it.

## Layout

```
backend/
  main.py          FastAPI app; launches DBOS in the lifespan
  config.py        settings from .env
  models.py        pydantic models (filters, columns, answers, requests)
  llm.py           the only module that calls OpenAI
  seed.py          loads data/documents via manifest.json
  api/             routers: documents, reviews, templates
  db/              connection pool, document and review queries, schema.sql
  documents/       parse (PDF/txt/md), filters → SQL, plain English → filters
  extraction/      prompt + schema from columns, quote verification
  reviews/         DBOS workflows, CSV export
frontend/          Vite + React + Tailwind + shadcn; pages/ Reviews, Documents, NewReview, Review
data/              documents/ (seed corpus + manifest.json), templates.json
tests/             pytest
```

## Next to build

- **Reference documents per review**, such as the current spec, so cross-document questions ("contradicts spec?", "commitment met?") can be answered.
- **Human sign-off.** Accept or override a cell with an audit trail, plus grid filtering and sorting (unverified, not found, failed).
- **Partial re-runs.** Re-run a single row or column, and use the Batch API for non-urgent reviews.
- **Ingestion pipeline.** Keep originals in S3, parse as its own workflow, add OCR and DOCX, and show the real PDF page in the evidence pane.
- **Long documents.** Per-column retrieval or map-reduce, so they no longer fail with "document too large".
- **Scale-out deployment.** Separate API and worker processes, server-side grid paging, and SSE instead of polling.
- **Evals.** Per-template precision and recall plus the quote verification rate, run on every prompt or model change.
