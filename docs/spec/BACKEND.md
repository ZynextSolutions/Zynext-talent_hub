## Backend Specification

Production Express API for Zynext TalentHub. Shared-database multi-tenancy (`organization_id` on every tenant table), JWT access + rotating refresh tokens, and a strict controller → service → repository split. Super Admin lives in `platform_admins` and is never an org-scoped `users` row.

**Runtime:** Node.js 22 LTS, TypeScript 5.x (`strict: true`), Express 4.x, Prisma 6.x, PostgreSQL 16.

**Base URL:** `http://localhost:4000/api/v1` (dev) · `{API_PUBLIC_URL}/api/v1` (prod)

**Auth header:** `Authorization: Bearer <accessToken>`

---

### 4.1 Layering and request lifecycle

```
HTTP
  → helmet / cors / compression / requestId / pino
  → express.json (size-capped)
  → rateLimiter (global)
  → route-specific rateLimiter (auth)
  → authenticate          (JWT → req.auth)
  → resolveTenant         (req.tenant)
  → requirePermission     (RBAC)
  → validate(zodSchema)   (req.validated)
  → controller            (HTTP only: parse, call service, map status)
  → service               (business rules, transactions)
  → repository            (Prisma; ALWAYS filters by organizationId)
  → errorHandler          (typed AppError → envelope)
```

Controllers must not import Prisma. Repositories must not contain business rules. Services must not read `req` or write HTTP.

---

### 4.2 Folder structure (`backend/src/`)

Prisma schema, migrations, and seed live at **repo root** (`prisma/`). The backend package generates/consumes the client via `prisma.schema` path in `backend/package.json`.

```
backend/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nodemon.json
├── .env.example                    # points at root .env via dotenv-flow or symlink
└── src/
    ├── index.ts                    # process bootstrap, SIGTERM, uncaughtException
    ├── app.ts                      # express() + middleware + route mount
    ├── server.ts                   # listen(); extracted for tests
    ├── config/
    │   ├── env.ts                  # zod-parsed process.env (fail-fast on boot)
    │   ├── cors.ts
    │   ├── rate-limit.ts
    │   └── constants.ts            # token TTLs, bcrypt rounds, pageSize max
    ├── types/
    │   ├── express.d.ts            # Express.Request augmentation
    │   ├── auth.ts                 # JwtPayload, AuthPrincipal, ActorType
    │   ├── tenant.ts
    │   ├── pagination.ts
    │   └── errors.ts
    ├── middleware/
    │   ├── request-id.ts
    │   ├── authenticate.ts         # access JWT; sets req.auth
    │   ├── optional-auth.ts        # public routes that behave differently if logged in
    │   ├── resolve-tenant.ts       # sets req.tenant; platform vs org
    │   ├── require-permission.ts   # factory: requirePermission('course:assign')
    │   ├── require-platform.ts     # actorType === 'platform'
    │   ├── require-org-admin.ts
    │   ├── scope-manager.ts        # injects manager subtree filter
    │   ├── validate.ts             # validate({ body, query, params })
    │   ├── rate-limit.ts           # wrappers around express-rate-limit + redis
    │   ├── audit.ts                # writes audit_logs after mutating handlers
    │   └── error-handler.ts        # last; maps AppError / Zod / Prisma
    ├── routes/
    │   ├── index.ts                # mounts /health + /api/v1/*
    │   ├── health.routes.ts
    │   ├── auth.routes.ts
    │   ├── platform.routes.ts      # Super Admin only
    │   ├── organizations.routes.ts
    │   ├── org-tree.routes.ts      # tree + move-node
    │   ├── divisions.routes.ts
    │   ├── departments.routes.ts
    │   ├── teams.routes.ts
    │   ├── users.routes.ts
    │   ├── courses.routes.ts
    │   ├── lessons.routes.ts
    │   ├── assignments.routes.ts
    │   ├── enrollments.routes.ts
    │   ├── progress.routes.ts
    │   ├── assessments.routes.ts
    │   ├── certificates.routes.ts
    │   └── analytics.routes.ts
    ├── controllers/
    │   ├── health.controller.ts
    │   ├── auth.controller.ts
    │   ├── platform.controller.ts
    │   ├── organization.controller.ts
    │   ├── org-tree.controller.ts
    │   ├── division.controller.ts
    │   ├── department.controller.ts
    │   ├── team.controller.ts
    │   ├── user.controller.ts
    │   ├── course.controller.ts
    │   ├── lesson.controller.ts
    │   ├── assignment.controller.ts
    │   ├── enrollment.controller.ts
    │   ├── progress.controller.ts
    │   ├── assessment.controller.ts
    │   ├── certificate.controller.ts
    │   └── analytics.controller.ts
    ├── services/
    │   ├── auth.service.ts
    │   ├── token.service.ts        # access/refresh issue, rotate, revoke family
    │   ├── password.service.ts     # hash, verify, policy
    │   ├── platform.service.ts
    │   ├── organization.service.ts
    │   ├── org-tree.service.ts
    │   ├── org-move.service.ts     # drag-drop; transactional
    │   ├── hierarchy.service.ts    # resolve descendants / ancestors
    │   ├── division.service.ts
    │   ├── department.service.ts
    │   ├── team.service.ts
    │   ├── user.service.ts
    │   ├── rbac.service.ts
    │   ├── course.service.ts
    │   ├── lesson.service.ts
    │   ├── assignment.service.ts
    │   ├── enrollment.service.ts   # cascade enroll / reconcile on move
    │   ├── progress.service.ts
    │   ├── assessment.service.ts
    │   ├── certificate.service.ts  # issuance rules
    │   ├── analytics.service.ts
    │   ├── audit.service.ts
    │   └── mail.service.ts         # interface; SMTP in prod, console in dev
    ├── repositories/
    │   ├── prisma.ts               # singleton PrismaClient
    │   ├── base.repository.ts      # assertOrg(organizationId) helper
    │   ├── platform-admin.repository.ts
    │   ├── organization.repository.ts
    │   ├── division.repository.ts
    │   ├── department.repository.ts
    │   ├── team.repository.ts
    │   ├── user.repository.ts
    │   ├── role.repository.ts
    │   ├── refresh-token.repository.ts
    │   ├── course.repository.ts
    │   ├── lesson.repository.ts
    │   ├── assignment.repository.ts
    │   ├── enrollment.repository.ts
    │   ├── progress.repository.ts
    │   ├── assessment.repository.ts
    │   ├── certificate.repository.ts
    │   ├── audit-log.repository.ts
    │   └── analytics.repository.ts
    ├── validators/                 # zod schemas; one file per resource
    │   ├── pagination.schema.ts
    │   ├── auth.schema.ts
    │   ├── org-move.schema.ts
    │   ├── division.schema.ts
    │   ├── department.schema.ts
    │   ├── team.schema.ts
    │   ├── user.schema.ts
    │   ├── course.schema.ts
    │   ├── lesson.schema.ts
    │   ├── assignment.schema.ts
    │   ├── enrollment.schema.ts
    │   ├── progress.schema.ts
    │   ├── assessment.schema.ts
    │   └── analytics.schema.ts
    ├── domain/
    │   ├── roles.ts                # RoleName enum + permission catalog
    │   ├── node-types.ts           # ORGANIZATION | DIVISION | DEPARTMENT | TEAM | USER
    │   ├── assignment-targets.ts
    │   └── enrollment-status.ts
    ├── errors/
    │   ├── app-error.ts            # AppError(code, status, message, details?)
    │   ├── codes.ts                # ErrorCode union + HTTP map
    │   └── prisma-map.ts           # P2002 → CONFLICT, P2025 → NOT_FOUND
    ├── lib/
    │   ├── jwt.ts
    │   ├── bcrypt.ts
    │   ├── crypto.ts               # sha256, nanoid, certificate numbers
    │   ├── pagination.ts
    │   ├── envelope.ts             # success()/fail() helpers
    │   └── clock.ts                # injectable Date for tests
    └── jobs/                       # optional; not required for v1 boot
        └── reconcile-enrollments.job.ts
```

Root Prisma (consumed, not owned, by backend):

```
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
```

---

### 4.3 Conventions

#### Envelope

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "01J…",
    "pagination": { "page": 1, "pageSize": 25, "total": 87, "totalPages": 4 }
  }
}
```

`meta.pagination` is omitted on non-list responses. `data` is `null` on `204`-equivalent deletes (still return `200` with `data: { id }` for client simplicity).

Error:

```json
{
  "success": false,
  "error": {
    "code": "ORG_MOVE_INVALID_PARENT",
    "message": "A team can only be moved under a department in the same organization.",
    "details": [
      { "path": "targetParentType", "message": "Expected DEPARTMENT" }
    ]
  },
  "meta": { "requestId": "01J…" }
}
```

Never leak Prisma messages, stack traces, or SQL in `error.message` outside `NODE_ENV=development`.

#### IDs, time, pagination

| Rule | Value |
|------|--------|
| IDs | UUID v7 (time-sortable) or UUID v4; Prisma `@db.Uuid` |
| Timestamps | ISO-8601 UTC (`2026-08-30T14:53:00.000Z`) |
| Pagination | `page` (1-based, default 1), `pageSize` (default 25, max 100) |
| Sort | `sort=field:asc\|desc`; whitelist per resource |
| Soft delete | `deletedAt` on orgs, users, courses; repositories default `deletedAt: null` |
| Idempotency | `Idempotency-Key` header required on `POST /courses/:id/assign` and `POST /enrollments` |

#### Actor model (`req.auth`)

```ts
type ActorType = 'user' | 'platform';

interface AuthPrincipal {
  actorType: ActorType;
  sub: string;                 // users.id OR platform_admins.id
  email: string;
  organizationId: string | null; // null iff actorType === 'platform'
  role: RoleName | 'SUPER_ADMIN';
  permissions: string[];       // e.g. ['course:read', 'org:write']
  tokenFamilyId: string;       // refresh-token family for reuse detection
}
```

JWT access payload is the same shape minus `permissions` (permissions are loaded from DB/cache on each request so revokes take effect within one access TTL).

#### Tenant context (`req.tenant`)

```ts
interface TenantContext {
  organizationId: string;          // always set for org-scoped routes
  isolation: 'strict' | 'platform';
  // platform isolation: organizationId taken from ?organizationId= (required)
}
```

Repositories receive `organizationId: string` as a **required first argument**. Omitting it is a compile error (`TenantScoped<T>` helper). Platform routes that operate across tenants call `organizationRepository.listAll()` — the only methods allowed to skip the filter — and those methods live on a `PlatformOrganizationRepository`, not the tenant repo.

---

### 4.4 Middleware stack

Order in `app.ts` is mandatory. Changing order is a security defect.

#### 4.4.1 Global (every request)

| # | Middleware | Behavior |
|---|------------|----------|
| 1 | `trust proxy` | `app.set('trust proxy', 1)` behind the load balancer so rate-limit IP is real |
| 2 | `requestId` | Honor incoming `X-Request-Id` if it matches `^[A-Za-z0-9_-]{8,64}$`; else generate ULID. Bind to pino child logger. Echo on response. |
| 3 | `helmet` | CSP off for API; `hidePoweredBy`; `referrerPolicy: no-referrer`; HSTS in prod (`maxAge: 15552000`) |
| 4 | `cors` | See §4.10. Allowlist only. `credentials: true`. Methods `GET,POST,PATCH,PUT,DELETE,OPTIONS`. Headers `Authorization,Content-Type,Idempotency-Key,X-Request-Id`. |
| 5 | `compression` | gzip, skip when `Content-Type` is already compressed |
| 6 | `express.json` | `limit: '1mb'`. Multipart is **not** accepted on this process (uploads go via presigned S3). |
| 7 | `express.urlencoded` | `extended: false`, `limit: '32kb'` — unused by JSON clients; kept for health probes |
| 8 | `globalRateLimit` | 300 req / 15 min / IP (prod). 2000 in dev. Skip `/health` and `/ready`. |
| 9 | pino-http | Redact `req.headers.authorization`, `password`, `token`, `refreshToken`. |

#### 4.4.2 `authenticate`

- Read `Authorization: Bearer`. Missing/malformed → `401 AUTH_MISSING_TOKEN`.
- Verify access JWT (`HS256` or `RS256` if `JWT_PUBLIC_KEY` set). Expired → `401 AUTH_TOKEN_EXPIRED`. Invalid → `401 AUTH_TOKEN_INVALID`.
- Reject tokens with `typ !== 'access'`.
- If `actorType === 'user'`: load user by `sub` **and** `organizationId` from token; require `status === 'ACTIVE'` and `deletedAt IS NULL`. Suspended → `403 AUTH_ACCOUNT_SUSPENDED`.
- If `actorType === 'platform'`: load `platform_admins` by `sub`; require `status === 'ACTIVE'`.
- Hydrate `permissions` via `rbacService.getPermissions(role)` (in-memory map after boot; invalidate on seed/role change).
- Attach `req.auth`. Do **not** trust `organizationId` from query/body for tenant users.

Public routes (`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/platform/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/accept-invite`, `/health`, `/ready`) skip this middleware.

#### 4.4.3 `resolveTenant`

- **Org user:** `req.tenant = { organizationId: req.auth.organizationId, isolation: 'strict' }`. If `req.auth.organizationId` is null → `401 AUTH_PRINCIPAL_INVALID` (should be impossible).
- **Platform actor on `/api/v1/platform/*`:** no tenant required.
- **Platform actor on org-scoped routes** (impersonation / support): require query `organizationId` (UUID). Missing → `400 TENANT_REQUIRED`. Unknown/deleted org → `404 ORGANIZATION_NOT_FOUND`. Set `isolation: 'platform'`. Write an audit row (`PLATFORM_TENANT_ACCESS`) asynchronously **before** the handler runs.
- Org users supplying a different `organizationId` in query/body → ignore silently (never switch tenant). If they send a conflicting id, log `TENANT_OVERRIDE_ATTEMPT` at warn.

#### 4.4.4 `requirePermission(permission: Permission \| Permission[])`

Factory. ALL of the listed permissions must be present (AND). For OR, call twice on separate routes.

```ts
router.post(
  '/courses/:id/assign',
  authenticate,
  resolveTenant,
  requirePermission('course:assign'),
  validate(assignCourseSchema),
  assignmentController.assign,
);
```

Manager scope: after permission check, `scopeManager` attaches `req.scope`:

```ts
interface DataScope {
  kind: 'org' | 'department' | 'team' | 'self';
  departmentId?: string;
  teamId?: string;
  userId?: string;
}
```

| Role | `req.scope` |
|------|-------------|
| SUPER_ADMIN (platform) | `org` for the selected tenant |
| ORG_ADMIN | `org` |
| MANAGER | `department` of the manager's `departmentId` (required; managers without a department → `403 RBAC_SCOPE_MISSING`) |
| INSTRUCTOR | `org` for course content they own or org-wide read; user PII limited to enrolled learners |
| EMPLOYEE | `self` |

Services **must** pass `req.scope` into list/get methods. Repositories apply the extra `WHERE` (see §4.8).

#### 4.4.5 `validate(schema)`

Zod. Map issues to `400 VALIDATION_ERROR` with `details[].path` as JSON-pointer (`body.email`, `query.page`). Strip unknown keys (`passthrough` forbidden on body). Coerce query numbers. UUID params via `z.string().uuid()`.

#### 4.4.6 `errorHandler`

Last middleware. Mapping:

| Source | HTTP | Code |
|--------|------|------|
| `AppError` | `err.status` | `err.code` |
| Zod | 400 | `VALIDATION_ERROR` |
| Prisma `P2002` | 409 | `CONFLICT_UNIQUE` |
| Prisma `P2025` | 404 | `NOT_FOUND` |
| Prisma `P2003` | 409 | `CONFLICT_FK` |
| Prisma `P2034` | 409 | `TX_WRITE_CONFLICT` (client may retry) |
| `SyntaxError` (bad JSON) | 400 | `INVALID_JSON` |
| Unexpected | 500 | `INTERNAL_ERROR` |

On 500: log full error with `requestId`; response message is always `"An unexpected error occurred."`.

Do not `next()` after sending. Do not include `err.stack` unless `NODE_ENV=development`.

---

### 4.5 Permission catalog and RBAC matrix

Permissions are `{resource}:{action}`. Seeded globally (`roles.organization_id` null, `is_system: true`). v1 does not support custom org roles; adding them later must not change this catalog.

| Permission | Super Admin | Org Admin | Manager | Instructor | Employee |
|------------|:-----------:|:---------:|:-------:|:----------:|:--------:|
| `platform:org:read` | ✓ | | | | |
| `platform:org:write` | ✓ | | | | |
| `org:read` | ✓* | ✓ | ✓ | ✓ | ✓ |
| `org:write` | ✓* | ✓ | | | |
| `org:tree:read` | ✓* | ✓ | ✓ | | |
| `org:tree:write` | ✓* | ✓ | | | |
| `org:move` | ✓* | ✓ | | | |
| `division:*` / `department:*` / `team:*` CRUD | ✓* | ✓ | read only (own subtree) | | |
| `user:read` | ✓* | ✓ | subtree | enrolled learners | self |
| `user:write` | ✓* | ✓ | employees in subtree | | |
| `user:invite` | ✓* | ✓ | employees in subtree | | |
| `course:read` | ✓* | ✓ | ✓ | ✓ | assigned only |
| `course:write` | ✓* | ✓ | | ✓ | |
| `course:publish` | ✓* | ✓ | | ✓ | |
| `course:assign` | ✓* | ✓ | own subtree targets | | |
| `enrollment:read` | ✓* | ✓ | subtree | own courses | self |
| `enrollment:write` | ✓* | ✓ | subtree | | |
| `progress:write` | | | | | self (own enrollment) |
| `assessment:write` | ✓* | ✓ | | ✓ | |
| `assessment:submit` | | | | | self |
| `certificate:read` | ✓* | ✓ | subtree | own courses | self |
| `certificate:revoke` | ✓* | ✓ | | | |
| `analytics:read` | ✓* | ✓ | subtree | own courses | | |

\* Platform actor must pass `?organizationId=` on org-scoped routes.

`INSTRUCTOR` cannot mutate org tree. `MANAGER` cannot create `ORG_ADMIN` or `INSTRUCTOR` users.

---

### 4.6 REST API catalog

Unless noted, all routes require `authenticate` + `resolveTenant`. List responses use the envelope with `meta.pagination`.

Shared resource shapes (referenced below):

```ts
type Uuid = string; // RFC 4122

interface OrganizationDto {
  id: Uuid;
  name: string;
  slug: string;
  logoUrl: string | null;
  settings: {
    timezone: string;          // IANA, default "UTC"
    allowDivisionlessDepts: boolean;
    certificatePrefix: string; // e.g. "ACME"
  };
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

interface DivisionDto {
  id: Uuid;
  organizationId: Uuid;
  name: string;
  code: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface DepartmentDto {
  id: Uuid;
  organizationId: Uuid;
  divisionId: Uuid | null;
  name: string;
  code: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface TeamDto {
  id: Uuid;
  organizationId: Uuid;
  departmentId: Uuid;
  name: string;
  code: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
type RoleName = 'ORG_ADMIN' | 'MANAGER' | 'INSTRUCTOR' | 'EMPLOYEE';

interface UserDto {
  id: Uuid;
  organizationId: Uuid;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: RoleName;
  status: UserStatus;
  divisionId: Uuid | null;
  departmentId: Uuid | null;
  teamId: Uuid | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserPublicDto {
  id: Uuid;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: RoleName;
}

type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

interface CourseDto {
  id: Uuid;
  organizationId: Uuid;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;          // trailer / default
  scormPackageUrl: string | null;   // stored; runtime not in v1
  status: CourseStatus;
  durationMinutes: number | null;
  createdByUserId: Uuid;
  lessonCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LessonDto {
  id: Uuid;
  organizationId: Uuid;
  courseId: Uuid;
  title: string;
  description: string | null;
  order: number;                    // 0-based, contiguous after reorder
  content: string | null;           // markdown
  videoUrl: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

type AssignmentTargetType = 'ORGANIZATION' | 'DIVISION' | 'DEPARTMENT' | 'TEAM' | 'USER';

interface CourseAssignmentDto {
  id: Uuid;
  organizationId: Uuid;
  courseId: Uuid;
  targetType: AssignmentTargetType;
  targetId: Uuid;                   // org id when targetType=ORGANIZATION
  createdByUserId: Uuid;
  createdAt: string;
}

type EnrollmentStatus = 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVOKED';

interface EnrollmentDto {
  id: Uuid;
  organizationId: Uuid;
  userId: Uuid;
  courseId: Uuid;
  status: EnrollmentStatus;
  source: 'ASSIGNMENT' | 'MANUAL' | 'MOVE_RECONCILE';
  assignmentId: Uuid | null;
  progressPercent: number;          // 0–100 integer
  completedAt: string | null;
  enrolledAt: string;
  updatedAt: string;
}

interface LessonProgressDto {
  id: Uuid;
  enrollmentId: Uuid;
  lessonId: Uuid;
  completed: boolean;
  positionSeconds: number;
  completedAt: string | null;
  updatedAt: string;
}

interface CertificateDto {
  id: Uuid;
  organizationId: Uuid;
  enrollmentId: Uuid;
  userId: Uuid;
  courseId: Uuid;
  certificateNumber: string;        // unique globally
  issuedAt: string;
  revokedAt: string | null;
  verificationUrl: string;
}

interface AuthUserBundle {
  user: UserDto;
  organization: OrganizationDto;
  permissions: string[];
}
```

---

#### 4.6.1 Health (no auth)

##### `GET /health`

Liveness. No DB. `200`

```json
{ "success": true, "data": { "status": "ok", "uptimeSeconds": 12 } }
```

##### `GET /ready`

Readiness. `SELECT 1` via Prisma with 2s timeout. `200` or `503 SERVICE_UNAVAILABLE`.

```json
{ "success": true, "data": { "status": "ready", "database": "up" } }
```

---

#### 4.6.2 Auth

Auth routes use `authRateLimit`: **5 requests / 15 min / IP** for login, register, forgot-password; **30 / 15 min / IP** for refresh.

##### `POST /api/v1/auth/register`

Creates a new **organization** and the first **ORG_ADMIN**. Not an employee self-serve join.

**Body**

```json
{
  "organizationName": "Acme Corp",
  "organizationSlug": "acme-corp",
  "admin": {
    "email": "admin@acme.com",
    "password": "correct-horse-battery-staple",
    "firstName": "Ava",
    "lastName": "Chen"
  }
}
```

`organizationSlug`: `^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$`, unique globally.

**201** `data`: `{ accessToken, refreshToken, expiresIn: 900, user, organization, permissions }`

**Errors:** `409 ORGANIZATION_SLUG_TAKEN`, `409 AUTH_EMAIL_TAKEN` (email unique per org; on register the org is new so this is rare), `400 PASSWORD_POLICY`.

Transaction: organization + admin user + default settings. See §4.9.

##### `POST /api/v1/auth/login`

**Body:** `{ "email": "admin@acme.com", "password": "...", "organizationSlug": "acme-corp" }`

`organizationSlug` is **required** (same email may exist in two tenants).

**200:** same bundle as register.

**401 AUTH_INVALID_CREDENTIALS** — identical message for unknown email, wrong org, wrong password (timing-safe dummy hash on miss).

**403 AUTH_ACCOUNT_LOCKED** — after 10 failed attempts in 15 minutes (key: `login:{orgSlug}:{email}`). Unlock automatically after 15 min or via Org Admin `POST /users/:id/unlock`.

**403 AUTH_ACCOUNT_SUSPENDED** | **403 AUTH_ORG_SUSPENDED**

On success: reset failure counter; set `users.lastLoginAt`; issue token family.

##### `POST /api/v1/auth/platform/login`

**Body:** `{ "email": "admin@platform.com", "password": "..." }`

Looks up `platform_admins` only. **200:**

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900,
  "admin": { "id": "…", "email": "admin@platform.com", "name": "Platform Admin" },
  "permissions": ["platform:org:read", "platform:org:write"]
}
```

No `organization`. Subsequent org-scoped calls need `?organizationId=`.

##### `POST /api/v1/auth/refresh`

**Body:** `{ "refreshToken": "..." }`

**200:** `{ accessToken, refreshToken, expiresIn }` (rotation: new refresh, old hashed token marked used).

**401 AUTH_REFRESH_REUSE** — presented token already used → revoke **entire family**, force re-login. Audit `TOKEN_REUSE_DETECTED`.

**401 AUTH_REFRESH_INVALID** | **401 AUTH_REFRESH_EXPIRED**

##### `POST /api/v1/auth/logout`

Auth required. **Body:** `{ "refreshToken": "..." }` (optional; if omitted, revoke current family from access `tokenFamilyId`).

**200:** `{ "revoked": true }`

##### `GET /api/v1/auth/me`

**200:** `{ user, organization, permissions }` or platform `{ admin, permissions }`.

##### `PATCH /api/v1/auth/me`

Org users only. **Body:** `{ "firstName?", "lastName?", "avatarUrl?" }`. Cannot change email/role/org here.

##### `POST /api/v1/auth/change-password`

**Body:** `{ "currentPassword", "newPassword" }`. Invalidates **all** refresh families except the current one (optional `revokeOthers: true` default true).

##### `POST /api/v1/auth/forgot-password`

**Body:** `{ "email", "organizationSlug" }`. Always **200** `{ "sent": true }` (no user enumeration). If user exists and ACTIVE, store hashed one-time token (1h TTL) and send email.

##### `POST /api/v1/auth/reset-password`

**Body:** `{ "token", "newPassword" }`. **200** then all refresh families revoked.

##### `POST /api/v1/auth/accept-invite`

**Body:** `{ "token", "password", "firstName", "lastName" }`. Invite TTL 7 days. Sets `status: ACTIVE`, hashes password. **201** with login bundle.

---

#### 4.6.3 Platform (`require-platform`)

##### `GET /api/v1/platform/organizations`

Query: pagination + `q` (name/slug ilike) + `status`.

**200:** `OrganizationDto[]` plus `userCount`, `courseCount` per row.

##### `POST /api/v1/platform/organizations`

**Body:** `{ "name", "slug", "adminEmail", "adminFirstName", "adminLastName" }`

Creates org + INVITED org admin + invite email (no password until accept-invite). **201** `{ organization, invite }`.

##### `GET /api/v1/platform/organizations/:id`

**200:** org + counts + `createdAt`.

##### `PATCH /api/v1/platform/organizations/:id`

**Body:** `{ "name?", "status?": "ACTIVE"|"SUSPENDED", "settings?" }`

Suspending org: subsequent org-user logins → `403 AUTH_ORG_SUSPENDED`. Existing access tokens remain valid until expiry (max 15 min). Refresh is rejected while suspended.

##### `DELETE /api/v1/platform/organizations/:id`

Soft-delete: `deletedAt = now()`. **200** `{ id, deletedAt }`. Hard purge is out of band (ops).

##### `GET /api/v1/platform/audit-logs`

Query: `organizationId?`, `actorId?`, `action?`, `from`, `to`, pagination.

---

#### 4.6.4 Organization (tenant)

##### `GET /api/v1/organizations/current`

**200:** `OrganizationDto`. Org Admin may see `settings`; Employee gets public subset (`name`, `slug`, `logoUrl`).

##### `PATCH /api/v1/organizations/current`

`org:write`. **Body:** `{ "name?", "logoUrl?", "settings?" }`. Slug is immutable after register (platform can rename via platform PATCH if needed — v1: slug immutable).

---

#### 4.6.5 Org tree

##### `GET /api/v1/org/tree`

`org:tree:read`. Query: `includeUsers=true|false` (default true). Manager: subtree only (their department node as root of the payload, still nested under org for breadcrumb).

**200**

```json
{
  "organization": { "id": "…", "name": "Acme Corp", "slug": "acme-corp" },
  "divisions": [
    {
      "id": "…",
      "name": "North America",
      "sortOrder": 0,
      "departments": [
        {
          "id": "…",
          "name": "Engineering",
          "divisionId": "…",
          "sortOrder": 0,
          "teams": [
            {
              "id": "…",
              "name": "Platform",
              "departmentId": "…",
              "sortOrder": 0,
              "users": [
                { "id": "…", "firstName": "Ava", "lastName": "Chen", "role": "MANAGER", "email": "ava@acme.com" }
              ]
            }
          ]
        }
      ]
    }
  ],
  "unassignedDepartments": [
    { "id": "…", "name": "Shared Services", "divisionId": null, "teams": [], "sortOrder": 0 }
  ]
}
```

`unassignedDepartments` holds departments with `divisionId = null` (legal when `settings.allowDivisionlessDepts === true`).

##### `PATCH /api/v1/org/move-node`

`org:move`. Drag-drop handler. **Must** run in a single serializable transaction (see §4.7.1 and §4.9).

**Body**

```json
{
  "nodeType": "DEPARTMENT" | "TEAM" | "USER",
  "nodeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "targetParentType": "ORGANIZATION" | "DIVISION" | "DEPARTMENT" | "TEAM",
  "targetParentId": "8b2e…"
}
```

`targetParentId` is required except when `nodeType=DEPARTMENT` and `targetParentType=ORGANIZATION` (detach from division → `divisionId = null`).

**200**

```json
{
  "nodeType": "TEAM",
  "nodeId": "…",
  "previousParent": { "type": "DEPARTMENT", "id": "…" },
  "parent": { "type": "DEPARTMENT", "id": "…" },
  "affectedUserIds": ["…"],
  "enrollmentsAdded": 12,
  "enrollmentsRetained": 3,
  "treeEtag": "W/\"a1b2\""
}
```

`treeEtag` is `hash(organization.updatedAt + max(child.updatedAt))` so the client can `If-Match` on subsequent moves if desired (optional header; v1: if `If-Match` sent and mismatch → `409 ORG_TREE_STALE`).

**Errors:** `ORG_MOVE_CROSS_TENANT`, `ORG_MOVE_INVALID_PARENT`, `ORG_MOVE_SAME_PARENT` (no-op still 200 with `unchanged: true` — prefer 200 to keep optimistic UI simple), `ORG_MOVE_TARGET_NOT_FOUND`, `ORG_MOVE_NODE_NOT_FOUND`, `ORG_MOVE_DIVISION_REQUIRED`, `TX_WRITE_CONFLICT`.

---

#### 4.6.6 Divisions

All scoped to `req.tenant.organizationId`.

| Method | Path | Perm | Notes |
|--------|------|------|-------|
| GET | `/api/v1/divisions` | `org:read` | pagination, `q` |
| GET | `/api/v1/divisions/:id` | `org:read` | 404 if other org |
| POST | `/api/v1/divisions` | `org:write` | body `{ name, code?, sortOrder? }` |
| PATCH | `/api/v1/divisions/:id` | `org:write` | |
| DELETE | `/api/v1/divisions/:id` | `org:write` | blocked if departments still attached unless `?reassignTo=` or `detachDepartments=true` |

**POST 201** `DivisionDto`

**DELETE query:** `detachDepartments=true` sets child `divisionId = null` (requires `allowDivisionlessDepts`). Else `409 DIVISION_HAS_CHILDREN`.

---

#### 4.6.7 Departments

| Method | Path | Perm |
|--------|------|------|
| GET | `/api/v1/departments` | `org:read` |
| GET | `/api/v1/departments/:id` | `org:read` |
| POST | `/api/v1/departments` | `org:write` |
| PATCH | `/api/v1/departments/:id` | `org:write` |
| DELETE | `/api/v1/departments/:id` | `org:write` |

**POST body**

```json
{
  "name": "Engineering",
  "code": "ENG",
  "divisionId": null,
  "sortOrder": 0
}
```

If `divisionId` is non-null, it must belong to the same org. If null, require `settings.allowDivisionlessDepts` else `400 ORG_MOVE_DIVISION_REQUIRED`.

**DELETE:** `409 DEPARTMENT_HAS_TEAMS` unless `?cascadeTeams=false` (default) — v1 does **not** cascade-delete teams. Client must move or delete teams first.

---

#### 4.6.8 Teams

| Method | Path | Perm |
|--------|------|------|
| GET | `/api/v1/teams` | `org:read` |
| GET | `/api/v1/teams/:id` | `org:read` |
| POST | `/api/v1/teams` | `org:write` |
| PATCH | `/api/v1/teams/:id` | `org:write` |
| DELETE | `/api/v1/teams/:id` | `org:write` |

**POST body:** `{ "name", "departmentId", "code?", "sortOrder?" }` — `departmentId` required, same org.

**DELETE:** `409 TEAM_HAS_USERS` unless all users moved. Never orphan users (`users.team_id` is required in v1).

---

#### 4.6.9 Users

| Method | Path | Perm | Notes |
|--------|------|------|-------|
| GET | `/api/v1/users` | `user:read` | filters below; manager auto-scoped |
| GET | `/api/v1/users/:id` | `user:read` | |
| POST | `/api/v1/users` | `user:invite` | invite; no password |
| PATCH | `/api/v1/users/:id` | `user:write` | |
| DELETE | `/api/v1/users/:id` | `user:write` | soft-delete |
| POST | `/api/v1/users/:id/resend-invite` | `user:invite` | |
| POST | `/api/v1/users/:id/suspend` | `user:write` | |
| POST | `/api/v1/users/:id/activate` | `user:write` | |
| POST | `/api/v1/users/:id/unlock` | `user:write` | clears lockout counter |

**GET query:** `q`, `role`, `status`, `divisionId`, `departmentId`, `teamId`, `page`, `pageSize`, `sort=lastName:asc`

**POST body**

```json
{
  "email": "dev@acme.com",
  "firstName": "Dev",
  "lastName": "Patel",
  "role": "EMPLOYEE",
  "teamId": "…"
}
```

Service derives `departmentId` and `divisionId` from the team. Manager may only invite `EMPLOYEE` into a team under their department. Role `ORG_ADMIN` only by existing Org Admin or platform.

**PATCH body:** `{ "firstName?", "lastName?", "role?", "teamId?", "status?" }`

Changing `teamId` is equivalent to `move-node` with `nodeType=USER` and **must** go through `orgMoveService` (not a raw repo update) so enrollments reconcile.

**DELETE:** sets `deletedAt`, `status=DEACTIVATED`, revokes refresh families. Enrollments retained for analytics. Email unique constraint uses `(organization_id, email)` WHERE `deletedAt IS NULL` (partial unique index).

**UserDto** never includes `passwordHash`. Email visible to Org Admin/Manager; Instructor sees email of enrolled learners; Employee sees only self.

---

#### 4.6.10 Courses

| Method | Path | Perm |
|--------|------|------|
| GET | `/api/v1/courses` | `course:read` |
| GET | `/api/v1/courses/:id` | `course:read` |
| POST | `/api/v1/courses` | `course:write` |
| PATCH | `/api/v1/courses/:id` | `course:write` |
| DELETE | `/api/v1/courses/:id` | `course:write` |
| POST | `/api/v1/courses/:id/publish` | `course:publish` |
| POST | `/api/v1/courses/:id/archive` | `course:write` |
| POST | `/api/v1/courses/:id/duplicate` | `course:write` |

**GET query:** `status`, `q`, pagination. Employee: only courses with an enrollment for `req.auth.sub`. Instructor: all org courses (read) / write own `createdByUserId` unless Org Admin.

**POST body**

```json
{
  "title": "Workplace Safety",
  "description": "…",
  "thumbnailUrl": null,
  "videoUrl": null,
  "scormPackageUrl": null,
  "durationMinutes": 45
}
```

Creates `DRAFT`. **201** `CourseDto`.

**PATCH:** cannot patch `status` here; use publish/archive.

**POST publish:** requires ≥1 lesson. `409 COURSE_NO_LESSONS` otherwise. Sets `publishedAt`.

**DELETE:** soft-delete. `409 COURSE_HAS_ACTIVE_ENROLLMENTS` if any `ENROLLED|IN_PROGRESS` unless `?force=true` (Org Admin only) which revokes those enrollments.

**GET `/:id`** includes `lessons: LessonDto[]` sorted by `order`, and `assignments: CourseAssignmentDto[]` if caller has `course:assign` or `org:write`.

---

#### 4.6.11 Lessons (nested)

| Method | Path | Perm |
|--------|------|------|
| GET | `/api/v1/courses/:courseId/lessons` | `course:read` |
| POST | `/api/v1/courses/:courseId/lessons` | `course:write` |
| PATCH | `/api/v1/lessons/:id` | `course:write` |
| DELETE | `/api/v1/lessons/:id` | `course:write` |
| PUT | `/api/v1/courses/:courseId/lessons/reorder` | `course:write` |

**POST body:** `{ "title", "description?", "content?", "videoUrl?", "durationSeconds?", "order?" }` — if `order` omitted, append.

**PUT reorder body:** `{ "lessonIds": ["uuid", "uuid"] }` — must be a permutation of all lessons in the course. Transaction: rewrite `order` 0..n-1. Recalculate enrollment `progressPercent` for in-flight enrollments (denominator changed).

**DELETE:** reindex remaining lessons; recalc progress. If a lesson is deleted, its `progress` rows are deleted (FK cascade). Percent may drop; do **not** revoke certificates already issued.

---

#### 4.6.12 Course assignments (cascade enroll)

##### `POST /api/v1/courses/:id/assign`

`course:assign`. Idempotency-Key required.

**Body**

```json
{
  "targetType": "DEPARTMENT",
  "targetId": "…"
}
```

Course must be `PUBLISHED` (`409 COURSE_NOT_PUBLISHED`). Target must exist in the same org. Manager: `targetType` ∈ `{ DEPARTMENT, TEAM, USER }` and target inside `req.scope`.

**201** (new assignment) or **200** (idempotent replay):

```json
{
  "assignment": { "id": "…", "courseId": "…", "targetType": "DEPARTMENT", "targetId": "…" },
  "enrolledCount": 42,
  "alreadyEnrolledCount": 5,
  "skippedInactiveCount": 2
}
```

##### `GET /api/v1/courses/:id/assignments`

List `CourseAssignmentDto[]`.

##### `DELETE /api/v1/courses/:id/assignments/:assignmentId`

Removes the assignment row. **Does not** unenroll users who already have progress (`IN_PROGRESS` or `COMPLETED`). Users still `ENROLLED` with 0% and `source=ASSIGNMENT` for this assignment **are** revoked (`status=REVOKED`). Documented as “keep learning history”. **200** `{ revokedEnrollmentCount, retainedEnrollmentCount }`.

---

#### 4.6.13 Enrollments

| Method | Path | Perm |
|--------|------|------|
| GET | `/api/v1/enrollments` | `enrollment:read` |
| GET | `/api/v1/enrollments/:id` | `enrollment:read` |
| POST | `/api/v1/enrollments` | `enrollment:write` |
| POST | `/api/v1/enrollments/:id/revoke` | `enrollment:write` |

**GET query:** `userId`, `courseId`, `status`, pagination. Employee forced `userId=self`.

**POST** (manual enroll, Org Admin/Manager): `{ "userId", "courseId" }`. User must be in scope. Upsert unique `(organization_id, user_id, course_id)`. Reactivating `REVOKED` resets status to `ENROLLED` but **keeps** existing progress rows.

**GET `:id`** includes `progress: LessonProgressDto[]`, `certificate: CertificateDto | null`, `course` summary, `user` public dto.

---

#### 4.6.14 Progress (learner)

##### `PUT /api/v1/enrollments/:id/progress/lessons/:lessonId`

`progress:write` (self only). Body:

```json
{
  "completed": false,
  "positionSeconds": 142
}
```

Lesson must belong to the enrollment's course. Enrollment must not be `REVOKED`. **200:** `{ lessonProgress, enrollment: { progressPercent, status } }`.

Marking `completed: true` is monotonic (cannot uncomplete via this endpoint). Heartbeats with `completed: false` only update `positionSeconds`.

##### `POST /api/v1/enrollments/:id/progress/lessons/:lessonId/complete`

Convenience alias: `{ completed: true }`. Triggers percentage recalc and certificate evaluation (§4.7.3).

---

#### 4.6.15 Assessments

| Method | Path | Perm |
|--------|------|------|
| GET | `/api/v1/courses/:courseId/assessments` | `course:read` |
| POST | `/api/v1/courses/:courseId/assessments` | `assessment:write` |
| GET | `/api/v1/assessments/:id` | role-dependent |
| PATCH | `/api/v1/assessments/:id` | `assessment:write` |
| DELETE | `/api/v1/assessments/:id` | `assessment:write` |
| POST | `/api/v1/assessments/:id/submit` | `assessment:submit` |
| GET | `/api/v1/assessments/:id/attempts` | `enrollment:read` |

**AssessmentDto**

```ts
interface AssessmentDto {
  id: Uuid;
  organizationId: Uuid;
  courseId: Uuid;
  title: string;
  passingScore: number;     // 0–100
  maxAttempts: number | null;
  questionCount: number;
}
```

**Question (instructor GET includes answers; learner GET strips `correctOptionId`)**

```ts
interface QuestionDto {
  id: Uuid;
  prompt: string;
  options: { id: Uuid; text: string }[];
  correctOptionId?: Uuid;   // omitted for learners
  order: number;
}
```

**POST assessment body:** `{ "title", "passingScore": 70, "maxAttempts": 3, "questions": [ { "prompt", "options": ["A","B"], "correctOptionIndex": 0 } ] }`

v1: one assessment per course (`409 ASSESSMENT_EXISTS` on second). Enough for certification gate.

**POST submit** (learner)

```json
{
  "enrollmentId": "…",
  "answers": [{ "questionId": "…", "optionId": "…" }]
}
```

**200**

```json
{
  "attempt": {
    "id": "…",
    "score": 80,
    "passed": true,
    "attemptNumber": 1,
    "submittedAt": "…"
  },
  "certificate": { "id": "…", "certificateNumber": "ACME-2026-7KQ2" }
}
```

`certificate` is `null` if not yet eligible. **409 ASSESSMENT_MAX_ATTEMPTS**. **409 ENROLLMENT_NOT_READY** if lesson progress &lt; 100% (v1 requires all lessons complete before quiz). **403** if enrollment not owned by caller.

Learner GET of assessment after submit may include per-question correctness for that attempt (`showAnswersAfterAttempt: true` in org settings, default true).

---

#### 4.6.16 Certificates

| Method | Path | Perm |
|--------|------|------|
| GET | `/api/v1/certificates` | `certificate:read` |
| GET | `/api/v1/certificates/:id` | `certificate:read` |
| GET | `/api/v1/certificates/number/:certificateNumber` | public **or** auth |
| POST | `/api/v1/certificates/:id/revoke` | `certificate:revoke` |

**GET list** query: `userId`, `courseId`. Employee: self only.

**GET by number:** used for employer verification. Public response is **minimal**: `{ valid: true, holderName, courseTitle, issuedAt, organizationName }` without PII beyond name. Revoked → `{ valid: false, reason: "REVOKED" }`. Rate-limit 30/min/IP.

**Revoke body:** `{ "reason": "issued in error" }`. Sets `revokedAt`. Does not change enrollment completion (learning record stays).

No PDF in v1; `verificationUrl` is `{PUBLIC_WEB_URL}/verify/{certificateNumber}`. Frontend renders a print stylesheet.

---

#### 4.6.17 Analytics

All `analytics:read`. Manager automatically subtree-scoped. Instructor: courses they created. Query: `from`, `to` (ISO date, inclusive, org timezone), optional `divisionId|departmentId|teamId` (must be inside scope).

##### `GET /api/v1/analytics/dashboard`

**200**

```json
{
  "kpis": {
    "userCount": 120,
    "activeUserCount": 98,
    "courseCount": 12,
    "publishedCourseCount": 9,
    "enrollmentCount": 430,
    "completionRate": 0.62,
    "certificatesIssued": 88,
    "averageProgressPercent": 71
  },
  "enrollmentsOverTime": [{ "date": "2026-08-01", "enrolled": 12, "completed": 4 }],
  "topCourses": [{ "courseId": "…", "title": "…", "enrolled": 80, "completed": 50, "completionRate": 0.625 }]
}
```

`completionRate` = completed enrollments / (enrollments − revoked) in the window.

##### `GET /api/v1/analytics/by-org-level`

Query: `level=DIVISION|DEPARTMENT|TEAM`

**200:** `{ "rows": [{ "id", "name", "userCount", "enrollmentCount", "completionRate", "avgProgress" }] }`

##### `GET /api/v1/analytics/users/:id`

Org Admin/Manager (in scope). Per-user course list with progress — for the people-analytics drilldown.

---

### 4.7 Service-layer business rules

#### 4.7.1 Move-node (`orgMoveService.moveNode`)

**Allowed edges (closed set)**

| `nodeType` | Allowed `targetParentType` | FK written |
|------------|----------------------------|------------|
| `DEPARTMENT` | `DIVISION` | `departments.division_id = targetParentId` |
| `DEPARTMENT` | `ORGANIZATION` | `departments.division_id = null` (only if `allowDivisionlessDepts`) |
| `TEAM` | `DEPARTMENT` | `teams.department_id = targetParentId` |
| `USER` | `TEAM` | `users.team_id = targetParentId` + denormalized dept/div |

Forbidden: moving a division, moving org, dropping a team onto a division, dropping a user onto a department, any cross-organization id, moving a node onto itself.

**Algorithm**

1. `SELECT … FOR UPDATE` the node row **and** the target parent row inside `prisma.$transaction` (isolation `Serializable`, timeout 5s, maxWait 2s).
2. Assert both `organization_id` equal `tenant.organizationId` (and each other). Else `ORG_MOVE_CROSS_TENANT` (403 — treated as security event, audit).
3. Load parent chain of the target; assert type table above. Else `ORG_MOVE_INVALID_PARENT`.
4. Circular check: for v1 the graph is a strict 4-level tree, so a cycle is only possible if we later add parent_id on same-type nodes. Still run: target must not equal node; if `nodeType` were ever recursive, reject if target is in descendants. Keep the helper.
5. If parent unchanged → return `{ unchanged: true }` without enrollment work.
6. Apply FK update.
7. **Denormalized user cascade**
   - Department moved to another division (or null): `UPDATE users SET division_id = :new WHERE department_id = :dept AND organization_id = :org`.
   - Team moved to another department: for every user with that `team_id`, set `department_id` and `division_id` from the new department.
   - User moved to another team: set `team_id`, `department_id`, `division_id` from the new team.
8. Call `enrollmentService.reconcileAfterHierarchyChange({ organizationId, affectedUserIds })` **in the same transaction**.
9. Touch `organizations.updatedAt` (optimistic concurrency / etag).
10. Return affected ids + enrollment diffs.

Do not emit HTTP inside the service. Do not start a second transaction for step 8.

**Concurrency:** two simultaneous drops on the same node: serializable isolation retries once (`P2034`); on second failure surface `TX_WRITE_CONFLICT` (409) so the UI rolls back and refetches the tree.

#### 4.7.2 Enrollment cascade (`enrollmentService`)

**Resolve users for a target** (`hierarchyService.usersUnder`)

| targetType | Predicate (always `AND organization_id = :org AND deleted_at IS NULL AND status IN ('ACTIVE','INVITED')`) |
|------------|------------|
| ORGANIZATION | all org users |
| DIVISION | `division_id = :id` |
| DEPARTMENT | `department_id = :id` |
| TEAM | `team_id = :id` |
| USER | `id = :id` |

INVITED users **are** enrolled so the course is waiting when they accept. SUSPENDED/DEACTIVATED are skipped (`skippedInactiveCount`).

**`assignCourse({ courseId, targetType, targetId })`**

1. Verify course `PUBLISHED` and same org.
2. Verify target exists in org (type-specific repo `getById(orgId, id)`).
3. Insert `course_assignments` with unique `(organization_id, course_id, target_type, target_id)`. Duplicate → treat as idempotent success and still run enroll (covers users added after the original assign).
4. `usersUnder` → for each user `upsertEnrollment`:
   - If no row: insert `ENROLLED`, `source=ASSIGNMENT`, `assignmentId`.
   - If `REVOKED`: set `ENROLLED` again, keep progress, new `assignmentId`.
   - If already `ENROLLED|IN_PROGRESS|COMPLETED`: leave status, increment `alreadyEnrolledCount`.
5. Batch inserts in chunks of 500 inside the same transaction.

**`reconcileAfterHierarchyChange({ affectedUserIds })`**

For each affected user:

1. Compute `desiredCourseIds` = distinct courses from all assignments whose target contains this user (org + their division + department + team + user-level).
2. **Add:** for each desired course not enrolled (or REVOKED), upsert as `ENROLLED`, `source=MOVE_RECONCILE`.
3. **Do not remove** `COMPLETED` enrollments even if the assignment no longer applies (history).
4. **Do not remove** `IN_PROGRESS` (retain learning).
5. **Revoke** `ENROLLED` with `progressPercent = 0` and `source ∈ {ASSIGNMENT, MOVE_RECONCILE}` if the course is no longer desired — user never started, assignment no longer covers them.
6. Manual enrollments (`source=MANUAL`) are never auto-revoked.

This is the rule behind “when user moves team → update enrollments” and “when course assigned to department → auto assign to all users”.

**`revokeAssignment`:** see API. Same retain/revoke split.

#### 4.7.3 Progress and certificate issuance (`progressService` + `certificateService`)

**Percent formula**

```
progressPercent = floor( completedLessonCount / totalLessonCount * 100 )
```

If `totalLessonCount === 0`, percent is 0 (course should not be published). Recalc on every lesson complete, lesson add/delete/reorder.

**Status machine**

```
ENROLLED --(first progress write)--> IN_PROGRESS
IN_PROGRESS --(percent=100 AND assessmentPassedOrNotRequired)--> COMPLETED
any non-COMPLETED --(admin revoke)--> REVOKED
REVOKED --(re-assign/manual)--> ENROLLED  (progress rows kept)
COMPLETED is terminal except revoke of certificate (enrollment stays COMPLETED)
```

**Assessment gate:** if the course has an assessment, 100% lessons is **not** enough. `COMPLETED` + certificate only after a passing attempt. If no assessment, 100% lessons is enough.

**`certificateService.issueIfEligible(enrollmentId)`** (called at end of progress complete and assessment submit, **same transaction** as the triggering write):

Preconditions (all required):

- Enrollment not `REVOKED`
- `progressPercent === 100`
- No existing non-revoked certificate for this `enrollment_id` (partial unique index)
- Assessment: none, **or** latest passing attempt exists

Then:

1. Generate `certificateNumber` = `{settings.certificatePrefix}-{YYYY}-{crockford(8)}` (Crockford base32, cryptographically random). Retry on unique collision (max 3).
2. Insert `certificates` (`issued_at = now()`).
3. Set enrollment `status=COMPLETED`, `completedAt=now()`.
4. Audit `CERTIFICATE_ISSUED`.

Idempotent: if a live certificate exists, return it without inserting.

**Revoke certificate:** sets `revokedAt`. Does not reopen the enrollment. Re-issue is **not** automatic; Org Admin may call an internal `reissue` later (v1: not exposed — learner keeps completion without a live cert until a new assignment path is added).

#### 4.7.4 Other service invariants

- **User create:** email normalized `trim + lower`. Team must be in org. Denormalize dept/div from team. Role change to `MANAGER` requires the user to have a `departmentId` (inferred from team).
- **Cannot demote the last ORG_ADMIN** → `409 LAST_ORG_ADMIN`.
- **Cannot delete self.**
- **Lesson order** always contiguous 0..n-1 after any mutation.
- **Publish** requires ≥1 lesson and title non-empty.
- **Register** slug unique among non-deleted orgs.

---

### 4.8 Repository patterns and `organization_id` enforcement

#### 4.8.1 Hard rules

1. Every tenant repository method signature starts with `organizationId: string`. ESLint rule `cor-lms/require-org-id` (custom) flags Prisma calls on tenant models without `organizationId` in `where`.
2. `findById` is always `findFirst({ where: { id, organizationId, deletedAt: null } })` — **never** `findUnique({ where: { id } })` on tenant tables (UUID is globally unique but we still filter to fail closed on IDOR).
3. Updates/deletes use `updateMany`/`deleteMany` with `id + organizationId` and check `count === 1`; `0` → `NOT_FOUND`. This prevents cross-tenant writes even if a bug passes a foreign id.
4. Nested writes (`create: { course: { connect: { id } } }`) must use `connect` with a compound where if Prisma supports it, or pre-fetch with org filter then connect by id **after** assertion.
5. Raw SQL (`$queryRaw`) must use tagged template parameters **and** include `organization_id = ${organizationId}`. Code review required.
6. `platform_admins` and `organizations` (list-all) live in separate repositories without the tenant helper.

#### 4.8.2 Base helper

```ts
// repositories/base.repository.ts
export function orgWhere(organizationId: string) {
  return { organizationId, deletedAt: null };
}

export function assertSingle(count: number, code = 'NOT_FOUND'): void {
  if (count !== 1) throw new AppError(code, 404, 'Resource not found');
}
```

Example:

```ts
async updateTeam(
  organizationId: string,
  id: string,
  data: Prisma.TeamUpdateManyMutationInput,
) {
  const res = await this.prisma.team.updateMany({
    where: { id, organizationId, deletedAt: null },
    data,
  });
  assertSingle(res.count);
  return this.getById(organizationId, id);
}
```

#### 4.8.3 Scope application

Repositories accept optional `scope: DataScope`. Manager list:

```ts
where: {
  ...orgWhere(organizationId),
  ...(scope.kind === 'department' ? { departmentId: scope.departmentId } : {}),
  ...(scope.kind === 'self' ? { id: scope.userId } : {}),
}
```

Tree fetch: one query per entity type (`findMany` divisions, departments, teams, users) then assemble in the service — **no N+1**. Indexes: `(organization_id, division_id)`, `(organization_id, department_id)`, `(organization_id, team_id)`.

#### 4.8.4 Transactions

Repositories expose either:

- methods that take `tx: Prisma.TransactionClient`, or
- the service calls `prisma.$transaction(async (tx) => { repo.withTx(tx).… })`.

`withTx` returns a clone bound to the transaction client. Services that span repos (move-node) **must** use one `tx`.

#### 4.8.5 Pagination

```ts
{ skip: (page - 1) * pageSize, take: pageSize }
```

`count` uses the same `where`. Never `take` without a `where` org filter.

---

### 4.9 Transaction boundaries and error codes

#### 4.9.1 Boundaries (must be atomic)

| Operation | Writes in one `$transaction` |
|-----------|------------------------------|
| `auth.register` | `organizations` + `users` (ORG_ADMIN) + default `settings` |
| `platform.createOrganization` | org + invited admin + invite token |
| `orgMoveService.moveNode` | node FK + user denorm + enrollment reconcile + org `updatedAt` |
| `assignmentService.assign` | `course_assignments` upsert + enrollment upserts (chunked **inside** the same tx; if user set &gt; 2k, still one tx — acceptable for corporate tenants; if &gt; 10k, split is a later optimization with an outbox) |
| `assignmentService.unassign` | delete assignment + conditional enrollment revokes |
| `progressService.completeLesson` | progress upsert + enrollment percent/status + maybe certificate |
| `assessmentService.submit` | attempt insert + maybe certificate + maybe enrollment COMPLETED |
| `userService.changeTeam` | delegates to `moveNode` |
| `lessonService.reorder / delete` | lesson rows + enrollment percent recalc (batch) |
| `auth.refresh` (rotation) | mark old token used + insert new hashed token; reuse path revokes family |
| `auth.logout` / `change-password` | revoke token rows |
| `user.softDelete` | user row + revoke tokens |

Reads-only methods must not open transactions.

**Prisma tx options for move-node and assign:** `{ isolationLevel: 'Serializable', timeout: 5000, maxWait: 2000 }`. Others: default `ReadCommitted`, timeout 10s.

On failure: throw `AppError`; Prisma rolls back. Controller never sends a partial success body.

#### 4.9.2 Error code catalog

HTTP is derived from the code. Clients should branch on `error.code`, not status.

| Code | HTTP | When |
|------|------|------|
| `VALIDATION_ERROR` | 400 | Zod failure |
| `INVALID_JSON` | 400 | Malformed body |
| `TENANT_REQUIRED` | 400 | Platform actor missing `organizationId` |
| `PASSWORD_POLICY` | 400 | Password fails policy |
| `ORG_MOVE_INVALID_PARENT` | 400 | Illegal nesting |
| `ORG_MOVE_DIVISION_REQUIRED` | 400 | Null division while setting forbids it |
| `ENROLLMENT_NOT_READY` | 400 | Quiz before 100% lessons |
| `AUTH_MISSING_TOKEN` | 401 | No Bearer |
| `AUTH_TOKEN_EXPIRED` | 401 | Access JWT exp |
| `AUTH_TOKEN_INVALID` | 401 | Bad signature / wrong typ |
| `AUTH_INVALID_CREDENTIALS` | 401 | Login miss |
| `AUTH_REFRESH_INVALID` | 401 | Unknown refresh |
| `AUTH_REFRESH_EXPIRED` | 401 | Refresh TTL |
| `AUTH_REFRESH_REUSE` | 401 | Reuse detection |
| `AUTH_PRINCIPAL_INVALID` | 401 | User missing after valid JWT |
| `AUTH_ACCOUNT_LOCKED` | 403 | Lockout |
| `AUTH_ACCOUNT_SUSPENDED` | 403 | User status |
| `AUTH_ORG_SUSPENDED` | 403 | Org status |
| `RBAC_FORBIDDEN` | 403 | Missing permission |
| `RBAC_SCOPE_MISSING` | 403 | Manager without department |
| `RBAC_SCOPE_VIOLATION` | 403 | Target outside subtree |
| `ORG_MOVE_CROSS_TENANT` | 403 | Cross-org move attempt |
| `NOT_FOUND` | 404 | Generic |
| `ORGANIZATION_NOT_FOUND` | 404 | |
| `ORG_MOVE_NODE_NOT_FOUND` | 404 | |
| `ORG_MOVE_TARGET_NOT_FOUND` | 404 | |
| `CONFLICT_UNIQUE` | 409 | Prisma P2002 |
| `CONFLICT_FK` | 409 | Prisma P2003 |
| `ORGANIZATION_SLUG_TAKEN` | 409 | |
| `AUTH_EMAIL_TAKEN` | 409 | `(org, email)` |
| `DIVISION_HAS_CHILDREN` | 409 | |
| `DEPARTMENT_HAS_TEAMS` | 409 | |
| `TEAM_HAS_USERS` | 409 | |
| `LAST_ORG_ADMIN` | 409 | |
| `COURSE_NO_LESSONS` | 409 | Publish |
| `COURSE_NOT_PUBLISHED` | 409 | Assign |
| `COURSE_HAS_ACTIVE_ENROLLMENTS` | 409 | Delete |
| `ASSESSMENT_EXISTS` | 409 | Second quiz |
| `ASSESSMENT_MAX_ATTEMPTS` | 409 | |
| `ORG_TREE_STALE` | 409 | If-Match |
| `TX_WRITE_CONFLICT` | 409 | Serializable retry exhausted |
| `RATE_LIMITED` | 429 | |
| `PAYLOAD_TOO_LARGE` | 413 | |
| `SERVICE_UNAVAILABLE` | 503 | Readiness / DB |
| `INTERNAL_ERROR` | 500 | Unknown |

`AppError` constructor: `new AppError(code, status, message, details?)`. `codes.ts` maps code → default status so callers can `throw AppError.from('TEAM_HAS_USERS')`.

---

### 4.10 Security requirements

#### 4.10.1 Passwords

- Algorithm: **bcrypt** cost factor **12** (`BCRYPT_ROUNDS`, min 12 in prod — env parser rejects lower).
- Store only `password_hash`. Never log passwords or tokens.
- Policy (enforced in `password.service.ts` and on register/invite/reset/change):
  - min 12 characters, max 128
  - at least one letter and one number
  - reject 10k common-password list (bundled `blocklist.txt`, substring match on lowercased password)
  - reject if password contains email local-part or org slug
- Verify with `bcrypt.compare`. Dummy compare against a precomputed hash when the user does not exist (constant-time login).
- `platform_admins.password_hash` uses the same policy and cost.

#### 4.10.2 JWT and refresh rotation

| Token | TTL | Storage | Claims |
|-------|-----|---------|--------|
| Access | **15 minutes** | Client memory (frontend); not in DB | `iss`, `aud`, `sub`, `actorType`, `organizationId`, `role`, `typ: 'access'`, `fam` (family id), `jti`, `iat`, `exp` |
| Refresh | **7 days** | HttpOnly cookie **or** JSON body (SPA in v1 uses body + `localStorage` is **forbidden** in spec; frontend must use memory + `sessionStorage` at most). DB: `refresh_tokens` table | `typ: 'refresh'`, `sub`, `fam`, `jti` |

Signing: `HS256` with `JWT_ACCESS_SECRET` (≥ 32 random bytes) and `JWT_REFRESH_SECRET` (different secret). Rotate secrets via `JWT_ACCESS_SECRET_PREVIOUS` for 15 min overlap.

**Refresh table (conceptual):** `id`, `family_id`, `user_id` nullable, `platform_admin_id` nullable, `token_hash` (SHA-256 of the raw token), `expires_at`, `used_at`, `revoked_at`, `created_at`, `user_agent`, `ip`. Unique on `token_hash`.

**Rotation:** each refresh grant marks the presented row `used_at` and inserts a new row same `family_id`. If presented hash is already `used_at` and not the latest — **reuse** → `revoked_at = now()` on all rows in `family_id`.

**Logout / password change / suspend / soft-delete:** revoke all families for that principal.

Issuer `iss = JWT_ISS` (e.g. `https://api.cor-lms.example`). Audience `aud = JWT_AUD` (`cor-lms-web`). Reject mismatch.

#### 4.10.3 Rate limiting

Store: Redis when `REDIS_URL` is set; else in-memory (dev only; log a warning). Use `express-rate-limit` + `rate-limit-redis`.

| Bucket | Limit | Key |
|--------|-------|-----|
| Global | 300 / 15 min | IP |
| Login / register / platform login / forgot-password | 5 / 15 min | IP |
| Login per identity | 10 / 15 min then lockout | `orgSlug + email` |
| Refresh | 30 / 15 min | IP |
| Certificate verify (public) | 30 / min | IP |
| Authenticated API | 600 / 15 min | `userId` or `platformAdminId` |

Response: `429 RATE_LIMITED` with `Retry-After`. Headers `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

#### 4.10.4 CORS

`CORS_ORIGINS` comma-separated exact origins (no `*`). Dev default `http://localhost:3000`. Prod: the Next.js origin only.

- `credentials: true`
- No reflection of arbitrary `Origin`
- Preflight cached `Access-Control-Max-Age: 600`

#### 4.10.5 Transport and headers

- HTTPS only in prod (`COOKIE_SECURE=true` if cookies are used).
- Helmet as in §4.4.1.
- `X-Request-Id` on every response.
- Disable `X-Powered-By`.
- JSON only; reject `text/html` bodies.

#### 4.10.6 Injection, IDOR, mass assignment

- Prisma parameterized queries only.
- Zod strip unknown fields; never `prisma.user.update({ data: req.body })`.
- All gets/updates scoped by `organizationId` (§4.8).
- File URLs (`videoUrl`, `thumbnailUrl`, `scormPackageUrl`, `avatarUrl`) validated as `https:` URLs on allowlisted hosts **or** our S3 bucket prefix. No `javascript:` or unprefixed paths.
- `content` markdown stored as text; XSS is a frontend concern; API still rejects null bytes.

#### 4.10.7 Secrets and config

Boot fails if any required env var is missing (`env.ts` zod). Never commit `.env`. Secrets: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_URL`, `SMTP_*`.

#### 4.10.8 Audit log

Persist `audit_logs`: `id`, `organization_id` nullable (platform events null), `actor_type`, `actor_id`, `action`, `resource_type`, `resource_id`, `metadata` JSON (no secrets), `ip`, `user_agent`, `request_id`, `created_at`.

Required actions: `AUTH_LOGIN_FAILURE`, `TOKEN_REUSE_DETECTED`, `ORG_MOVE`, `COURSE_ASSIGN`, `CERTIFICATE_ISSUED`, `CERTIFICATE_REVOKED`, `USER_ROLE_CHANGE`, `PLATFORM_TENANT_ACCESS`, `ORG_SUSPEND`.

Retention: 365 days (pg_cron or later job; document in ops).

#### 4.10.9 Miscellaneous

- Invite tokens: 32-byte random, stored hashed, single use, 7-day TTL.
- Password reset tokens: same, 1-hour TTL.
- Max JSON body 1mb; larger → `413`.
- Do not expose sequential integer IDs.
- Super Admin cannot be created via public register. Seed + break-glass runbook only.
- Org users cannot call `/api/v1/platform/*` (middleware `require-platform`).

---

### 4.11 Cross-cutting implementation notes

#### Logging

pino, level `info` prod / `debug` dev. Bind `requestId`, `actorId`, `organizationId`. Never log tokens, hashes, or answer keys.

#### Mail

`MailService` interface: `sendInvite`, `sendPasswordReset`, `sendCertificateIssued`. Dev transport: console. Prod: SMTP (`SMTP_HOST`). Templates are plaintext + simple HTML. Failures of mail after commit are logged; they do not roll back the transaction (invite token still valid).

#### Testing (required for merge)

- Unit: `org-move.service` (every allowed/forbidden edge), `enrollment.service` cascade and reconcile, `certificate.service` eligibility, password policy.
- Integration: supertest + testcontainers PostgreSQL; tenant isolation test (user A org cannot GET user B org by id → 404 not 403, to avoid existence leak **or** 404 uniformly — **use 404** for cross-tenant).
- Auth: refresh reuse detection integration test.

#### Performance baselines

- `GET /org/tree` for 2k users: &lt; 300ms p95 with the four-query assemble pattern.
- Move-node affecting ≤ 200 users: &lt; 500ms p95.
- Indexes as in the data-model spec: composite `(organization_id, id)` plus FK columns used in `usersUnder`.

---

### 4.12 Environment variables (backend)

| Name | Required | Notes |
|------|----------|-------|
| `NODE_ENV` | yes | `development` \| `test` \| `production` |
| `PORT` | no | default `4000` |
| `DATABASE_URL` | yes | Prisma |
| `JWT_ACCESS_SECRET` | yes | ≥ 32 chars |
| `JWT_REFRESH_SECRET` | yes | ≠ access secret |
| `JWT_ISS` | yes | |
| `JWT_AUD` | yes | |
| `JWT_ACCESS_TTL_SEC` | no | default `900` |
| `JWT_REFRESH_TTL_SEC` | no | default `604800` |
| `BCRYPT_ROUNDS` | no | default `12`; prod min 12 |
| `CORS_ORIGINS` | yes | comma-separated |
| `REDIS_URL` | prod yes | rate limit + optional lockout |
| `PUBLIC_WEB_URL` | yes | certificate verification links |
| `API_PUBLIC_URL` | yes | |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | prod | |
| `LOG_LEVEL` | no | default `info` |

---

### 4.13 Out of scope for backend v1 (explicit)

- SCORM runtime / xAPI LRS (store URL only)
- Certificate PDF binary generation
- Custom per-org roles
- Websockets / live presence
- S3 multipart upload API (clients send HTTPS URLs already hosted)
- Multi-assessment per course, question banks, randomization
- SSO/SAML/OIDC (interfaces may be stubbed; not implemented)
- Row-Level Security policies in PostgreSQL (app-layer isolation is the v1 guarantee; RLS is a hardening follow-up)

These exclusions keep the first production cut maintainable without weakening tenancy, RBAC, move-node, or certification rules.
