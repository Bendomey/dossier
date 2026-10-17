# R2 bucket for document uploads

One bucket (`dossier-documents`) serves production and local development,
with the same keys: development writes real documents to the same Supabase
database.

## CORS

Cloudflare dashboard → R2 → bucket → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://justo-africa.fly.dev", "http://localhost:3001"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

## Lifecycle rules

| Prefix | Action |
|---|---|
| `staging/` | Delete objects 1 day after upload |

## Credentials

R2 → Manage API tokens → Create token with **Object Read & Write** on this
bucket only. Put the access key, secret and account ID in `.envrc` locally and
in `fly secrets set R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=dossier-documents`
for production. Turn `UPLOADS_ENABLED` on in production only after docs/runbooks/indexing-launch.md step 8.
