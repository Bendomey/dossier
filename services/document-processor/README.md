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

## Scanned pages (OCR)

PDF pages that contain an image and have fewer than ~50 letters or digits in
their text layer (or mostly broken characters) are rendered at 150 dpi and
transcribed by `OCR_MODEL` (default `gemini-2.5-flash-lite`), one page at a
time. Each answer is cached at `org/{org}/versions/{version}/ocr/page-{n}.json`,
so retries never pay twice.

- More than 50 scanned pages in one document fails with `OCR_LIMIT_REACHED`.
- Each organization may send `OCR_MONTHLY_PAGE_LIMIT` pages a month (default
  500), reserved in `ocr_usage` before anything is sent; running out also
  fails with `OCR_LIMIT_REACHED`.
- Pages the model declines stay unread; a document with half or more of its
  pages unread fails with `NO_TEXT_FOUND`.

Try a file without the database:

```bash
make inspect FILE=scan.pdf OCR=1          # calls Gemini, prints tokens per page (costs money)
make inspect FILE=scan.pdf OCR_FROM=dir   # uses dir/page-<n>.md instead, no network
```

## Checks

`make check` (gofmt, go vet, go build). There are no automated tests in the MVP.

## Benchmark (`basic`: ¼ vCPU, 1 GiB)

`make docker && make bench`, then upload the largest supported file.

| File | Pages | Peak memory | Duration |
|---|---|---|---|
| Not measured yet — run `make docker && make bench` | | | |
| Scanned pages | | | |
