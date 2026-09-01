# Deployment — Zynext TalentHub

Production deployment guide for Railway (GUI or IaC), Docker Compose, and database operations.

## Architecture (Railway)

```
Browser → web (public) → /api/v1 proxy → api (private)
api → Postgres, Redis, volume /app/uploads
jobs (cron) → private api /api/v1/jobs/*
```

## Database migrations

- **Single baseline migration:** `prisma/migrations/20250830160000_baseline/`
- Generated from `prisma/schema.prisma` so `migrate deploy` matches the live schema exactly.
- **Production:** `backend/boot.cjs` runs `prisma migrate deploy` before the API listens.
- **Local dev:** `npm run db:migrate` (interactive) or `npm run db:migrate:deploy` (CI/prod style).

### P3009 — failed migration (including `20250830160000_baseline`)

Prisma blocks new runs when a migration row has `finished_at IS NULL`. That usually means the SQL **failed partway**, leaving a **partial schema**.

**Do not only run** `DELETE FROM "_prisma_migrations" …` — the next deploy will hit "already exists" errors and fail again.

**Fix (Railway GUI):**

1. Open **Postgres** → **Query** (or Data → SQL).
2. Paste and run [scripts/railway-db-reset.sql](../scripts/railway-db-reset.sql):

   ```sql
   DROP SCHEMA IF EXISTS public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO postgres;
   GRANT ALL ON SCHEMA public TO public;
   ```

   If `GRANT … TO postgres` errors, ignore it — the `DROP SCHEMA` / `CREATE SCHEMA` lines are what matter.

3. **Stop** any in-progress **api** deploy (or wait for it to finish failing).
4. Redeploy **api** **once** and watch logs for:
   `Applying migration 20250830160000_baseline` → success → `api_listening`.

**Alternative:** delete the Postgres service → add a new Postgres → update **api** `DATABASE_URL` → redeploy **api**.

### After upgrading from the old multi-file migration chain

Same reset as P3009 above — old tables/enums conflict with the baseline migration.

## Required secrets (api)

Generate (Git Bash):

```bash
openssl rand -hex 32    # JWT_ACCESS_SECRET
openssl rand -hex 32    # JWT_REFRESH_SECRET
openssl rand -hex 32    # JOB_SECRET
openssl rand -base64 32 # ENCRYPTION_KEY
```

Windows PowerShell: run `scripts/generate-secrets.ps1`

| Variable | Notes |
|----------|-------|
| `JWT_ACCESS_SECRET` | ≥ 32 chars, unique |
| `JWT_REFRESH_SECRET` | ≥ 32 chars, ≠ access |
| `JOB_SECRET` | ≥ 16 chars |
| `ENCRYPTION_KEY` | 32-byte base64 |
| `DATABASE_URL` | From Postgres plugin |
| `REDIS_URL` | From Redis plugin |
| `CORS_ORIGINS` | Web public URL (`https://…`) |
| `PUBLIC_WEB_URL` | Same as web domain |
| `API_PUBLIC_URL` | Same as web domain (browser proxy) |

## Railway GUI checklist

1. Postgres + Redis
2. **web** — `frontend/Dockerfile`, public domain, `/health`
3. **api** — `backend/Dockerfile`, volume `/app/uploads`, `/ready`, secrets above
4. **web** var: `API_PROXY_TARGET=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}`
5. Deploy **api** → **web**
6. Seed once (optional): `DATABASE_URL=… npm run db:seed`
7. **jobs** cron: same `JOB_SECRET`, tenant `ORGANIZATION_ID`

See [`.railway/README.md`](../.railway/README.md) for IaC (`railway config apply`).

## Docker Compose (local / VPS)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Runs migrate via `boot.cjs` on api start (same as Railway).

## Seed (first login)

Public registration is off in production (`ALLOW_PUBLIC_ORG_REGISTER=false`).

```bash
# One-time against production DATABASE_URL
npm run db:seed
```

Demo credentials are in root `README.md` — change passwords before go-live.

## Troubleshooting

| Symptom | Action |
|---------|--------|
| P3009 failed migration | Reset Postgres (above) and redeploy |
| API exits on boot | Check secrets; read `[boot]` log lines |
| `/ready` timeout | Deploy logs — migration or DB connection |
| Web login fails | Verify `API_PROXY_TARGET` on **web** |
| CORS errors | `CORS_ORIGINS` must match web URL exactly |
| Uploads lost | Mount volume at `/app/uploads` on **api** |

## Files reference

| Path | Role |
|------|------|
| `backend/Dockerfile` | API image |
| `backend/boot.cjs` | migrate deploy + start |
| `prisma.config.ts` | Prisma CLI config |
| `prisma/migrations/` | SQL migrations |
| `.railway/railway.ts` | Railway IaC (optional) |
