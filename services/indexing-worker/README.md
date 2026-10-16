# Indexing worker

Cloudflare Worker that runs the document pipeline in production: it consumes
the `indexing` queue and posts each message to the Go processor
(`services/document-processor`), which runs as a Cloudflare Container
(`basic`, two instances: `processor-0`, `processor-1`).
Spec: `docs/superpowers/specs/2026-10-09-document-ingestion-indexing-design.md`, section 3.

| Handler | Does |
|---|---|
| `queue(indexing)` | posts to a free instance; ack on 200/422, retry on 429 (both busy, 30 s) or anything else (30 s, 2 min, 10 min, 10 min) |
| `queue(indexing-dlq)` | fails the job with `RETRIES_EXHAUSTED` unless it is still heartbeating or already finished; retried every 5 minutes while the database is unreachable |
| `scheduled(*/5)` | requeues jobs whose heartbeat stopped 5+ minutes ago and re-publishes unpublished outbox rows, and re-sends jobs left Queued with no message for 30 minutes |
| `scheduled(0 3 * * *)` | logs (and, with `ORPHAN_SWEEP_DELETE=true`, deletes) R2 objects under `org/` that no version owns |

The sweeps and the DLQ connect through Hyperdrive as `indexing_worker`; the
container connects as `indexing_processor`.

```bash
yarn install
yarn run check # wrangler types + tsc
yarn deploy    # builds the Go image (Docker must be running) and deploys
yarn tail      # live logs
```

Setting up Cloudflare for the first time: `docs/runbooks/indexing-launch.md`.
