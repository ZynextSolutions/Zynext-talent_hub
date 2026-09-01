# Zynext TalentHub — Multi-Tenant Corporate Learning Management System

Multi-tenant corporate LMS with organization hierarchy, RBAC, drag-and-drop org tree, courses, enrollments, progress tracking, assessments, certificates, and platform admin.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, @dnd-kit |
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Auth | JWT (access + refresh tokens) |

## Project Structure

```
Cor_LMS/
├── prisma/           # Schema, migrations, seed
├── backend/          # Express API (/api/v1)
├── frontend/         # Next.js App Router
├── docs/spec/        # Specifications
├── docker-compose.yml          # Local PostgreSQL
└── docker-compose.prod.yml     # Full stack (postgres + api + web)
```

## Local Development

### Prerequisites

- Node.js 22+
- Docker (for PostgreSQL)

### Setup

```bash
npm install
npm install --prefix backend
npm install --prefix frontend

cp .env.example .env

docker compose up -d
npm run db:push    # dev schema sync
npm run db:seed

npm run dev        # API :4000, Web :3000
```

### Demo Credentials

| Role | Login | Email | Password | Org slug |
|------|-------|-------|----------|----------|
| Platform Admin | [/platform/login](http://localhost:3000/platform/login) | admin@platform.com | Platform123! | — |
| Org Admin (Acme) | [/login](http://localhost:3000/login) | admin@acme.com | Password123! | `acme` |
| Employee | [/login](http://localhost:3000/login) | alice@acme.com | Password123! | `acme` |

## Production Deployment

1. Copy `.env.example` to `.env` and set strong `JWT_*` secrets, `DATABASE_URL`, and `CORS_ORIGINS`.
2. Configure SMTP env vars for invite/reset emails (dev logs emails to console).
3. Optionally set `REDIS_URL` for distributed rate limiting.
4. Deploy with Docker:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The prod compose file runs `prisma migrate deploy` before starting the API.

### Railway

For managed hosting (Postgres, Redis, API, Web, cron, uploads volume), see [`.railway/README.md`](.railway/README.md). The web service proxies `/api/v1` to the private API at runtime via an App Router route — no build-time API URL is required.

### CI

GitHub Actions (`.github/workflows/ci.yml`) installs dependencies, pushes schema to Postgres, and builds backend + frontend on every push/PR.

## Features

| Feature | Backend | Frontend |
|---------|---------|----------|
| Org auth (register/login) | ✅ | ✅ |
| Platform admin console | ✅ | ✅ |
| Org tree drag-and-drop | ✅ | ✅ |
| User invite + accept | ✅ | ✅ |
| Course create/lessons/publish | ✅ | ✅ |
| Course assign to org nodes | ✅ | ✅ |
| Learning player + progress | ✅ | ✅ |
| Certificates + analytics | ✅ | ✅ |
| Assessments | ✅ | ⚠️ API only (no UI) |

## API

Base URL: `http://localhost:4000/api/v1`

See `docs/spec/BACKEND.md` for the full API specification.

## Troubleshooting

**Next.js `ENOENT` / missing chunks:** Stop dev server, then:

```bash
rm -rf frontend/.next && npm run dev
```

**Database connection failed:** Ensure `docker compose up -d` is running and `DATABASE_URL` matches `docker-compose.yml` credentials.

## License

Private — All rights reserved.
