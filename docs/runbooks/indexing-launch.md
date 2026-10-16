# Launching document indexing on Cloudflare

Containers need the Workers Paid plan.

One-time setup, then a production check, then uploads go on. Run the
`wrangler` commands from `services/indexing-worker` (`yarn wrangler …`).

## 1. Database roles (Supabase SQL editor)

```sql
ALTER ROLE indexing_worker WITH LOGIN PASSWORD '…';
-- indexing_processor was given LOGIN for local development already.
```

## 2. Queues

```bash
yarn wrangler queues create indexing
yarn wrangler queues create indexing-dlq
yarn wrangler queues info indexing     # note the queue ID for the app
```

## 3. Hyperdrive

Session pooler (port 5432) as `indexing_worker.<project-ref>`:

```bash
yarn wrangler hyperdrive create dossier-indexing --caching-disabled \
  --connection-string="postgresql://indexing_worker.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

Paste the printed ID into `wrangler.jsonc` in place of `REPLACE_WITH_HYPERDRIVE_ID`.

## 4. AI Gateway

Dashboard → AI → AI Gateway → Create gateway named `dossier`:

- Authenticated gateway: on. Create a token and keep it for `AI_GATEWAY_TOKEN`.
- Logs: collection off (requests carry document text).
- Caching: off.
- Rate limiting: 300 requests per minute, fixed window.

The gateway URL for Gemini is
`https://gateway.ai.cloudflare.com/v1/<account-id>/dossier/google-ai-studio`.

## 5. Worker secrets

```bash
yarn wrangler secret put PROCESSOR_DATABASE_URL   # session pooler, port 5432, as indexing_processor.<project-ref>
yarn wrangler secret put R2_ACCOUNT_ID
yarn wrangler secret put R2_ACCESS_KEY_ID
yarn wrangler secret put R2_SECRET_ACCESS_KEY
yarn wrangler secret put GEMINI_API_KEY           # Google AI Studio, billing-enabled project
yarn wrangler secret put GEMINI_BASE_URL          # the gateway URL above
yarn wrangler secret put AI_GATEWAY_TOKEN
```

## 6. Deploy the Worker and container

Start Docker, then `yarn deploy`. It builds `services/document-processor`
for linux/amd64, pushes it and deploys the Worker.

## 7. Point the app at the queue

API token: Cloudflare dashboard → My Profile → API Tokens → Create, permission
"Queues: Edit" on the account.

```bash
cd apps/app
fly secrets set CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… INDEXING_QUEUE_ID=… INDEXING_DISPATCH=queue
```

Keep `UPLOADS_ENABLED=false` for now. Apply pending migrations (`yarn db:deploy`
or the App workflow), then `make deploy`.

## 8. Check it in production before people can upload

Run the app locally against production infrastructure, publishing to the real
queue: in `apps/app/.envrc` set `INDEXING_DISPATCH=queue` plus the three
Cloudflare values, `UPLOADS_ENABLED=true`, and run `yarn dev`.

1. Upload a typed PDF and a scanned PDF. `yarn wrangler tail` shows `delivered`
   with status 200; both reach **Ready**. The AI Gateway dashboard shows the
   requests, with no stored payloads.
2. Outbox sweep: set `INDEXING_QUEUE_ID` to a wrong value, upload a file (it
   stays Queued), restore the value. Within about 6 minutes the tail shows
   `outbox_published` and the file reaches Ready.
3. Stalled job: with the production Worker deployed, run the processor
   locally (`make run` in services/document-processor) and set
   `INDEXING_DISPATCH=direct` in `.envrc` so the local processor takes the job.
   Upload a large file; while it shows Processing, `kill -9` the local
   processor. Within about 10 minutes `yarn wrangler tail` shows
   `jobs_requeued`, and the production container finishes the file (Ready).
   Container stopped mid-job: with queue dispatch, upload a large file and,
   while it is Processing, stop the running container instance from the
   Cloudflare dashboard (Workers & Pages → indexing-worker → Containers → the
   instance → Stop). Expected: the file ends Ready (the queue redelivers, or
   the sweep requeues it), never stuck Queued; if it is Queued after the
   failure, `jobs_resent` appears within about 35 minutes and it then ends
   Ready.
4. Busy pool: upload three large files at once. The third shows Queued until an
   instance is free, then Ready; none fails.
5. Dead letters: in the Cloudflare dashboard → Queues → `indexing-dlq` → send
   a message with content type JSON and the body as one object
   `{"event_id": "…", "organization_id": "…", "document_id": "…", "document_version_id": "…", "indexing_job_id": "…"}`
   for a job that is already Ready (`event_id` is the outbox row's id, the rest
   comes from its payload). The tail shows
   `dead_letter … failed: false`, and the document stays Ready.
6. Check the limits this design relies on, against current Cloudflare docs:
   queue consumer wall-clock time (15 minutes), the SIGTERM grace period for
   containers, and Containers pricing for the cost estimate.

Then revert `.envrc` to direct dispatch.

## 9. Turn uploads on

```bash
fly secrets set UPLOADS_ENABLED=true
```

## 10. Orphan sweep

For the first week the daily sweep only logs `orphans_found`. Read those logs;
if every listed key really has no version, turn deletion on:
`ORPHAN_SWEEP_DELETE` → `"true"` in `wrangler.jsonc`, then `yarn deploy`.

Changing `ORPHAN_SWEEP_DELETE` is a redeploy, which restarts the containers,
so do it when no document is processing.

## After launch

Watch the Worker logs for `dead_letter`, `jobs_requeued`, `jobs_resent`,
`dead_letter_unavailable` and `orphans_found`.
