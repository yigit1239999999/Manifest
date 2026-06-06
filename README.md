# PetTrack

A warm, multi-tenant CRM + CPM for veterinary practices. Each clinic signs up
to its own private workspace and manages clients (pet owners), pets, visits,
appointments, prescriptions, invoices and more.

Built with Next.js 16 (App Router), TypeScript, Prisma 7, Auth.js, next-intl
and Tailwind CSS v4.

## Requirements

- Node.js 20+
- A PostgreSQL database (e.g. Supabase)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file (see `.env.example`):

   ```bash
   # Pooled connection — used by the running app
   DATABASE_URL="postgresql://…@…:6543/postgres?pgbouncer=true"
   # Direct connection — used for schema migrations
   DIRECT_URL="postgresql://…@…:5432/postgres"
   # Generate with: openssl rand -base64 32 (min 32 chars)
   AUTH_SECRET="…"

   # Optional — error reporting
   SENTRY_DSN="…"
   NEXT_PUBLIC_SENTRY_DSN="…"
   ```

   With Supabase, copy both connection strings from
   **Connect → ORMs → Prisma** in the dashboard.

3. Apply the schema migrations:

   ```bash
   npm run db:migrate:deploy
   ```

   On the first deploy against a fresh Supabase project this creates the
   schema cleanly. For local dev iterations use `npm run db:migrate`
   (which creates new migrations from schema changes); `npm run db:push`
   is left in for one-off prototyping but **must not** be used against a
   migrated DB.

4. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the development server
- `npm run build` — production build
- `npm run db:migrate` — create + apply a new migration locally
- `npm run db:migrate:deploy` — apply pending migrations (CI / prod)
- `npm run db:migrate:status` — show pending / applied migrations
- `npm run db:migrate:reset` — drop & re-apply (local only — destroys data)
- `npm run db:studio` — open Prisma Studio
- `npm test` — Vitest unit + integration tests
- `npm run test:e2e` — Playwright E2E (needs a running app + DB)
- `npm run lint` — ESLint

## Deployment

The app is a standard Next.js 16 build and runs anywhere with Node.js 20+
(Vercel, Fly, a container, etc.).

1. **Environment variables** (same as Setup):
   - `DATABASE_URL` (pooled) and `DIRECT_URL` (direct)
   - `AUTH_SECRET` (≥ 32 chars — `openssl rand -base64 32`)
   - Optional: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`

2. **Apply migrations** against the production database:

   ```bash
   npm run db:migrate:deploy
   ```

   This also runs `CREATE EXTENSION IF NOT EXISTS pg_trgm` and creates the
   GIN trigram search indexes (see `prisma/migrations/*_pg_trgm_search`).
   The database user must be allowed to create extensions — on Supabase and
   most managed Postgres providers this works out of the box.

   > **Note:** these trigram indexes live only in the migrations (raw SQL),
   > because GIN `gin_trgm_ops` indexes can't be expressed in the Prisma
   > schema. That's expected — don't try to "fix" it by adding them to
   > `schema.prisma`, and don't add a `prisma migrate diff` drift check (it
   > would always report them as drift). CI deliberately omits that check.

3. **Build and start:**

   ```bash
   npm run build
   npm start
   ```

4. Point your platform's uptime/health check at `GET /api/health`.

The first account to **sign up** becomes the clinic **ADMIN**. Admins can add
and manage veterinarians and other staff under **Team** (`/staff`); those
users then show up in the veterinarian picker on visits and appointments.

### Local troubleshooting

- **"Next.js inferred your workspace root… multiple lockfiles"** — you have a
  stray `package-lock.json` in a parent directory (e.g. your home folder).
  Delete it (`rm ~/package-lock.json`) so the project's own lockfile is the
  only one, or set `turbopack.root` in `next.config.ts`.

## Operations

- **Health probe** lives at `GET /api/health` (`200` with `{db: "ok", sha}`
  when healthy, `503` when the DB is unreachable). Wire this into Vercel's
  health check or any external uptime monitor.
- **Error reporting** flows through Sentry when `SENTRY_DSN` is set; until
  then it's a no-op. Sourcemap upload activates when `SENTRY_ORG`,
  `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` are present.
- **Audit log** at `/audit` shows every mutation. Mutations now run inside
  Prisma `$transaction` so the audit row commits atomically with the
  underlying change.
- **JWT lifetime** is capped at 8 hours; rotating a user's password kicks
  every existing session.

## Verifying multi-tenancy

Sign up two separate clinics. Each one only ever sees its own clients,
pets, visits, appointments, prescriptions and invoices — every query is
scoped by the signed-in user's `clinicId` and corroborated by the role
matrix in `lib/permissions.ts`.

Soft-delete cascades: archiving a client also hides their pets, visits,
appointments and invoices from active list views (the underlying rows
remain for audit + timeline history).
