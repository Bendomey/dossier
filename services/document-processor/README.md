# Document processor

Turns uploaded documents into searchable chunks: downloads the file from R2,
extracts PDF / DOCX / TXT / Markdown into structured blocks, splits them into
section-aware chunks, embeds them with Gemini and activates the version.
Spec: `docs/superpowers/specs/2026-10-09-document-ingestion-indexing-design.md`.

## Run locally

Needs Go (1.26 is downloaded automatically) and Poppler (`brew install poppler`).

```bash
cp .env.example .env   # fill in DATABASE_URL (indexing_processor role), R2, Gemini
make run               # POST http://localhost:8080/jobs, GET /healthz
```

The app posts each indexing request here in development
(`INDEXING_DISPATCH=direct`). If the processor was down, re-send a queued job
with `make enqueue JOB=<indexing job id>`.

A processor killed mid-job leaves the job Processing. Once 2 minutes have
passed, recover it with `make enqueue JOB=<indexing job id>`.

## Database connection

`DATABASE_URL` must be the Supabase **session** pooler (port 5432), connecting
as `indexing_processor.<project-ref>`. The transaction pooler (port 6543) drops
the connection's `SET search_path`, so `::vector` would fail.

Before the first run, give the `indexing_processor` role LOGIN and a password in
the Supabase SQL editor:

```sql
ALTER ROLE indexing_processor WITH LOGIN PASSWORD '…';
```

## Look at extraction without the database

```bash
make inspect FILE=~/Documents/contract.pdf            # blocks
CHUNKS=1 make inspect FILE=~/Documents/contract.pdf   # chunks
```

## Checks

`make check` (gofmt, go vet, go build). There are no automated tests in the MVP.

## Benchmark (`basic`: ¼ vCPU, 1 GiB)

`make docker && make bench`, then upload the largest supported file.

| File | Pages | Peak memory | Duration |
|---|---|---|---|
| Not measured yet — run `make docker && make bench` | | | |
