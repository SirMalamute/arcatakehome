CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS documents (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title       text NOT NULL,
    filename    text NOT NULL,
    file_ext    text NOT NULL,
    type        text NOT NULL,
    authority   text NOT NULL,
    product     text,
    date        date,
    pages       jsonb NOT NULL,
    page_count  int NOT NULL,
    full_text   text NOT NULL,
    search      tsvector GENERATED ALWAYS AS (to_tsvector('english', full_text)) STORED,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_search_idx    ON documents USING gin (search);
CREATE INDEX IF NOT EXISTS documents_type_idx      ON documents (type);
CREATE INDEX IF NOT EXISTS documents_authority_idx ON documents (authority);
CREATE INDEX IF NOT EXISTS documents_product_idx   ON documents (product);
CREATE INDEX IF NOT EXISTS documents_date_idx      ON documents (date);

CREATE TABLE IF NOT EXISTS reviews (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    filter      jsonb NOT NULL,
    columns     jsonb NOT NULL,
    status      text NOT NULL DEFAULT 'draft',  -- draft | running | complete
    runs        int NOT NULL DEFAULT 0,          -- incremented per run; part of workflow IDs
    started_at  timestamptz,                     -- start of the latest run (for ETA)
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_items (
    review_id   uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status      text NOT NULL DEFAULT 'queued',  -- queued | running | done | failed
    answers     jsonb,
    error       text,
    tokens_in   int NOT NULL DEFAULT 0,
    tokens_out  int NOT NULL DEFAULT 0,
    finished_at timestamptz,
    PRIMARY KEY (review_id, document_id)
);

CREATE INDEX IF NOT EXISTS review_items_status_idx ON review_items (review_id, status);
