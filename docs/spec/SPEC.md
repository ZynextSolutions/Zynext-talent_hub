# Zynext TalentHub — Multi-Tenant Corporate LMS

See [README.md](../README.md) for setup instructions.

## Spec Index

- [Backend API](./BACKEND.md)
- Frontend UI — luxury hybrid design (Linear shell + Stripe KPI cards)
- Database — Prisma schema at `prisma/schema.prisma`; baseline migration `20250830160000_baseline`
- Deployment — [DEPLOYMENT.md](../DEPLOYMENT.md) (Railway, Docker, P3009)
- Security — JWT, RBAC, tenant isolation via `organization_id`

## Architecture

- **Frontend:** Next.js 15, TypeScript, Tailwind, shadcn/ui, @dnd-kit org tree
- **Backend:** Express, Prisma, PostgreSQL
- **Auth:** JWT access + refresh tokens, separate `platform_admins` table

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Platform Admin | admin@platform.com | Platform123! |
| Org Admin | admin@acme.com | Password123! |
