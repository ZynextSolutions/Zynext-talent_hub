# Railway — Zynext TalentHub

Project graph for a **single production replica**: Postgres, Redis, API, Web, daily cron jobs, and a volume at `/app/uploads`.

Railway Config as Code (`railway.toml` / `railway.json`) is deprecated. This repo uses [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) at `.railway/railway.ts`.

## One-time setup

1. Install the [Railway CLI](https://docs.railway.com/guides/cli) **5.42.1+**, then from the repo root:

   ```bash
   npm install --prefix .railway
   railway login
   railway link          # or create a new project, then link
   railway config plan
   railway config apply  # only after you review the plan
   ```

2. Generate a public domain on **web** (Service → Settings → Networking → Generate domain). Leave **api** private; the browser talks to web, which proxies `/api/v1` to the API at runtime.

3. Set secrets on **api** (or the plan will keep empty `preserve()` values and the API will not boot):

   ```bash
   openssl rand -hex 32          # JWT_ACCESS_SECRET
   openssl rand -hex 32          # JWT_REFRESH_SECRET  (must differ from access)
   openssl rand -hex 32          # JOB_SECRET  (min 16 chars)
   openssl rand -base64 32       # ENCRYPTION_KEY  (exactly 32 bytes, base64)
   ```

   After a custom domain is attached to web, change `CORS_ORIGINS`, `PUBLIC_WEB_URL`, and `API_PUBLIC_URL` from the generated `*.up.railway.app` host to `https://your-domain`.

4. Set secrets on **jobs** (cron):

   | Variable | Value |
   | --- | --- |
   | `JOB_SECRET` | Same value as on **api** |
   | `ORGANIZATION_ID` | Tenant UUID from Postgres (`organizations.id`) |

5. Connect the GitHub repo `ZynextSolutions/Zynext-talent_hub` to **api** and **web** if apply did not. Dockerfiles:

   | Service | Dockerfile | Context |
   | --- | --- | --- |
   | api | `backend/Dockerfile` | repository root |
   | web | `frontend/Dockerfile` | repository root |

   Do **not** set `PORT` on api or web. Railway injects it; the API listens on that value. Web reads `API_PROXY_TARGET=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}` at **runtime** (App Router proxy route), so redeploying api does not require rebuilding web.

   The API image runs `prisma migrate deploy` and only then starts listening. Healthcheck is `/ready` (not under `/api/v1`). Web healthcheck is `/health`. If `/ready` keeps failing, the process is not listening — read **Deploy logs**, not only the healthcheck panel.

6. Deploy order: **api** first, then **web**, then verify **jobs** variables. Cron does not need a public domain.

## Production rules

- **One API replica** while uploads live on the volume. Use S3 (`S3_BUCKET` + endpoint + keys) before you scale API replicas.
- `ALLOW_PUBLIC_ORG_REGISTER=false` and `ALLOW_QUERY_ACCESS_TOKEN=false`.
- Do not seed AMI (or any customer) with demo passwords.
- Optional dashboard vars on **api** (all use `preserve()` in IaC): `SENTRY_DSN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

## Cron jobs (`jobs` service)

The **jobs** function runs daily at `0 2 * * *` UTC and POSTs to the private API:

- `/api/v1/jobs/reminders`
- `/api/v1/jobs/recertify`
- `/api/v1/jobs/scheduled-reports`
- `/api/v1/jobs/cert-expiry`
- `/api/v1/jobs/analytics-snapshots`

Each call includes `?organizationId=<ORGANIZATION_ID>` and `X-Job-Secret`. The shell logic mirrors `scripts/railway-cron.sh` for local testing:

```bash
export JOB_SECRET=... API_HOST=... API_PORT=4000 ORGANIZATION_ID=...
sh scripts/railway-cron.sh
```

All-tenant runs (`X-Job-Scope: all`) are not configured for single-tenant AMI deploys.

## Apply vs dashboard

`omit` in `.railway/railway.ts` deletes managed resources on the next apply. Secrets use `preserve()` so apply does not overwrite values you set in the dashboard. Do not run `railway config apply --yes` from an agent unless you have reviewed that exact plan.
