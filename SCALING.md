# Scaling to 100k+ concurrent runs

The current design (one call per document, DBOS queues on Postgres, IDs-only workflow inputs) carries over at scale. These are the changes needed on top of it, grouped by what breaks first.

## 1. Model provider throughput (the real ceiling)
- **Rate-limit by tokens, not just requests.** OpenAI enforces tokens per minute (TPM) as well as requests (RPM). Add a token-bucket limiter keyed on the estimated input tokens alongside the DBOS queue limiter.
- **Spread load across capacity.**
  - Use several API keys, projects or regions (OpenAI plus Azure OpenAI), and route each call to whichever has headroom.
  - Request a raised tier, or provisioned throughput for steady volume.
- **Batch API for anything not urgent.** It costs half as much, has separate quota and finishes within 24h. Let the user pick "fast" or "overnight" per review.
- **Prompt caching.** Put the document first and the questions last (as now), and for reviews over the same corpus keep the shared prefix stable.
- **Model fallback.** When the primary model is saturated, retryable errors fall back to a secondary model, and the row records which model answered.

## 2. Orchestration (DBOS)
- **Stop holding a handle per document.** Right now `run_review` enqueues every document, then waits on all the handles. At 500k documents that is a huge workflow history and a lot of memory. Fix:
  - Enqueue in batches as child workflows ("enqueue page N").
  - Mark the review complete when its last item finishes, by checking a counter, instead of waiting on handles.
- **Split API and workers into separate deployments.** Workers autoscale on queue depth. Each worker gets a stable executor ID so DBOS can recover its in-flight workflows.
- **Fairness between tenants.**
  - Give each tenant its own queue or partition, with its own concurrency cap.
  - Add priorities, so one 500k review can't starve a 10-document one.
- **Give the DBOS system database its own Postgres instance**, so checkpoint writes don't compete with app queries.

## 3. Database
- **Connection pooling.** Put PgBouncer in front of Postgres. Thousands of workers can't each hold 20 connections.
- **Keep counters instead of recounting.** Progress is currently `count(*) FILTER …` over `review_items` on every 2-second poll. Keep a counter row per review instead, updated in the same transaction as each item's status change.
- **Partition `review_items`** by hash of `review_id`. Store answers in their own table or as compressed JSONB.
- **Read replicas** for the grid, search and exports. Writes stay on the primary.
- **Search beyond ~10M documents.** Move full text and facets to OpenSearch or Elasticsearch, fed by change data capture. Keep the same filter whitelist so the LLM-generated filters still compile safely.
- **Shard by tenant once one primary can't absorb the writes.**
  - Use Citus, or route to separate Postgres clusters at the application level.
  - Make `tenant_id` the distribution key on `documents`, `reviews` and `review_items`, so a review and its items always live on the same shard and every query stays on one shard.
  - Only admin and analytics views need to read across shards, and those go to a warehouse rather than the live databases.
  - A very large tenant gets its own dedicated shard.
- **Avoid hot rows.** A single counter row per review, updated by every worker, becomes a lock bottleneck. Split it into N slot rows, have each worker update a random slot, and sum the slots when reading.
- **Sizing and upkeep.**
  - Tune autovacuum aggressively on `review_items`, since it is updated constantly.
  - Archive finished reviews to cold storage, for example Parquet files in S3.
  - Run point-in-time recovery with a hot standby for failover.

### The DBOS system database
- **It is the queue, and it is write-heavy.** Each document records the workflow, ~5 step checkpoints and the queue state, so a 500k-document review writes several million rows. Keep step outputs to IDs and small values only, as now.
- **Dequeue contention.** Workers claim work by polling the workflow table with `FOR UPDATE SKIP LOCKED`. With thousands of workers, raise the polling interval, give each tenant its own queue, and watch lock waits.
- **Shard it along with the app.** Run one DBOS system database per app shard, with the workers for that shard pointed at it. That keeps queue load bounded, and a failing shard can't stall the others. The global rate limit then has to be divided across shards, or enforced by a shared token bucket such as one in Redis.
- **Retention.** Garbage-collect completed workflows after N days, using DBOS's workflow retention settings or a scheduled cleanup, so the tables and their indexes stay small.
- **Recovery.** Each worker needs a stable executor ID, and in-flight workflows must be handed to a live executor when a worker dies, either through DBOS Conductor or an equivalent.

## 4. Documents and ingestion
- **Store originals in S3**, keyed by content hash (which also deduplicates). Parsed pages also go in S3 or a `document_pages` table, not one JSONB blob per document.
- **Parse in the background.** Upload returns immediately, and parsing, OCR (Textract or Azure Document Intelligence) and DOCX handling run as their own durable workflows.
- **Long documents** go through per-column page retrieval or map-reduce, instead of failing with "document too large".

## 5. API and UI
- **Server-side paging** of the grid, with sorting and filtering in SQL. Today `GET /reviews/{id}` returns every item.
- **Push instead of poll.** Use SSE or WebSockets fed by Postgres `LISTEN/NOTIFY` or Redis pub/sub.
- **Exports run as background jobs.** Stream the CSV to S3 and hand back a signed URL. Today the whole CSV is built in memory.

## 6. Cost, safety and operations
- **Budgets.** Before a run, estimate from real token counts and require approval above a threshold. Enforce a hard per-review cap during the run.
- **Partial re-runs.** Re-run only one row or column, and cache answers by (document hash, column hash, model, prompt version) so unchanged work is never paid for twice.
- **Observability.** Track per-review throughput, 429 rate, cost, the quote verification rate and p95 latency per document. Trace every LLM call.
- **Evals as a release gate.** Changing a prompt or model must pass per-template precision, recall and verification-rate thresholds before it ships.
- **Load test.** Point a synthetic run of 100k documents at a mock LLM endpoint to find database and queue limits without paying for model calls.
