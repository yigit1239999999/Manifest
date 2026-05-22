# PetTrack

A warm, multi-tenant CRM for veterinary practices. Each clinic signs up to its
own private workspace and manages clients (pet owners) and their pets.

Built with Next.js 16 (App Router), TypeScript, Prisma 7, Auth.js, and
Tailwind CSS v4.

## Features

- Clinic sign-up / sign-in — every clinic's data is isolated by `clinicId`
- Clients — create, search, view, edit, and delete pet owners
- Pets — full CRUD, each pet linked to its owner (Owner → Pet)
- Clinic overview with counts and recent activity

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
   # Generate with: openssl rand -base64 32
   AUTH_SECRET="…"
   ```

   With Supabase, copy both connection strings from
   **Connect → ORMs → Prisma** in the dashboard.

3. Push the schema to your database:

   ```bash
   npx prisma db push
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the development server
- `npm run build` — production build
- `npm run db:push` — sync the Prisma schema to the database
- `npm run db:studio` — open Prisma Studio to inspect data

## Verifying multi-tenancy

Sign up two separate clinics. Each one only ever sees its own clients and
pets — every query is scoped by the signed-in user's `clinicId`.
