# Railway — Zynext TalentHub

Project graph for a **single production replica**: Postgres, Redis, API, Web, and a volume at `/app/uploads`.

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

2. Generate a public domain on **web** (Service → Settings → Networking → Generate domain). Leave **api** private; the browser talks to web, which proxies `/api/v1` to the API.

3. Set secrets on **api** (or the plan will keep empty `preserve()` values and the API will not boot):

   ```bash
   openssl rand -hex 32          # JWT_ACCESS_SECRET
   openssl rand -hex 32          # JWT_REFRESH_SECRET  (must differ from access)
   openssl rand -hex 32          # JOB_SECRET  (min 16 chars)
   openssl rand -base64 32       # ENCRYPTION_KEY  (exactly 32 bytes, base64)
   ```

   After a custom domain is attached to web, change `CORS_ORIGINS`, `PUBLIC_WEB_URL`, and `API_PUBLIC_URL` from the generated `*.up.railway.app` host to `https://your-domain`.

4. Connect the GitHub repo `ZynextSolutions/Zynext-talent_hub` to both **api** and **web** if apply did not. Dockerfiles:

   | Service | Dockerfile | Context |
   | --- | --- | --- |
   | api | `backend/Dockerfile` | repository root |
   | web | `frontend/Dockerfile` | repository root |

   The API image runs `npx prisma migrate deploy` and only then starts listening. Healthcheck is `/ready` (not under `/api/v1`). Web healthcheck is `/health`.

## Production rules

- **One API replica** while uploads live on the volume. Use S3 (`S3_BUCKET` + endpoint + keys) before you scale API replicas.
- `ALLOW_PUBLIC_ORG_REGISTER=false` and `ALLOW_QUERY_ACCESS_TOKEN=false`.
- Do not seed AMI (or any customer) with demo passwords.
- SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) is optional; add it in the dashboard when you want invite and reset mail.

## Cron jobs

Hit the **private** API (not the public web host) so `JOB_SECRET` is not sent across the internet. From a Railway cron service in the same project:

```bash
curl -fsS -X POST \
  "http://api.railway.internal:4000/api/v1/jobs/reminders?organizationId=<ORG_UUID>" \
  -H "X-Job-Secret: $JOB_SECRET"
```

Same pattern for `recertify`, `scheduled-reports`, `cert-expiry`, and `analytics-snapshots`. All-tenant runs require `X-Job-Scope: all` and should not be used for a single-tenant AMI deploy.

Suggested daily schedule: `0 2 * * *` (org timezone as needed).

## Apply vs dashboard

`omit` in `.railway/railway.ts` deletes managed resources on the next apply. Secrets use `preserve()` so apply does not overwrite values you set in the dashboard. Do not run `railway config apply --yes` from an agent unless you have reviewed that exact plan.
