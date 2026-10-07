// The recall list: every vaccination whose date has come or is about to,
// with what has been done about it.
//
// Raw SQL rather than Prisma's query builder for one reason: a row that
// already has an appointment booked sorts BELOW the rows that do not (pm
// B2 -- booked from the overdue card, the row did not change and stayed on
// top), and "has a future appointment" is a lateral join Prisma cannot order
// by. The filters are written to be the same rule as `overdueWhere` in
// `./queries.ts`, so the dashboard's count and this list's total agree; the
// test beside this file holds the two side by side.

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZES } from "@/lib/pagination";
import { OVERDUE_WINDOW_MONTHS, UPCOMING_WINDOW_DAYS } from "./queries";

export { UPCOMING_WINDOW_DAYS };


const DAY_MS = 86_400_000;

export const RECALL_VIEWS = ["overdue", "upcoming"] as const;
export type RecallView = (typeof RECALL_VIEWS)[number];

/**
 * How long overdue. `recent` is the dashboard card's window and the
 * default, so "Tümünü gör · 1.185" lands on 1.185 rows.
 */
export const RECALL_AGES = ["month", "recent", "older", "all"] as const;
export type RecallAge = (typeof RECALL_AGES)[number];

export const RECALL_CONTACTS = ["none", "called", "unreachable"] as const;
export type RecallContactFilter = (typeof RECALL_CONTACTS)[number];

export const RECALL_SORTS = ["due", "pet", "owner"] as const;
export type RecallSort = (typeof RECALL_SORTS)[number];

export interface RecallFilters {
  clinicId: string;
  view: RecallView;
  age?: RecallAge;
  vaccine?: string | null;
  species?: string | null;
  contact?: RecallContactFilter | null;
  sort?: RecallSort;
  now?: Date;
}

export interface RecallRow {
  id: string;
  name: string;
  nextDueAt: Date;
  petId: string;
  petName: string;
  species: string;
  ownerId: string;
  ownerFirstName: string;
  ownerLastName: string | null;
  ownerPhone: string | null;
  ownerLanguage: string | null;
  apptId: string | null;
  apptStartsAt: Date | null;
  lastOutcome: "CALLED" | "UNREACHABLE" | null;
  lastContactAt: Date | null;
  lastContactBy: string | null;
  contactCount: number;
}

function monthsBack(now: Date, months: number): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

/** The date window of a view, as a SQL condition on `v."nextDueAt"`. */
export function dueWindow(view: RecallView, age: RecallAge, now: Date): Prisma.Sql {
  if (view === "upcoming") {
    const until = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * DAY_MS);
    return Prisma.sql`v."nextDueAt" >= ${now} AND v."nextDueAt" <= ${until}`;
  }
  const recent = monthsBack(now, OVERDUE_WINDOW_MONTHS);
  switch (age) {
    case "month":
      return Prisma.sql`v."nextDueAt" >= ${new Date(now.getTime() - 30 * DAY_MS)} AND v."nextDueAt" < ${now}`;
    case "older":
      return Prisma.sql`v."nextDueAt" < ${recent}`;
    case "all":
      return Prisma.sql`v."nextDueAt" < ${now}`;
    case "recent":
    default:
      return Prisma.sql`v."nextDueAt" >= ${recent} AND v."nextDueAt" < ${now}`;
  }
}

/**
 * Every condition but the vaccine filter, so the vaccine options can be
 * read from the same set the list is.
 */
function baseWhere(f: RecallFilters, now: Date): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`v."clinicId" = ${f.clinicId}`,
    dueWindow(f.view, f.age ?? "recent", now),
    // Taken off the list by somebody: it stays on the animal's page.
    Prisma.sql`v."dueDismissedAt" IS NULL`,
    // The two layers the dashboard card has: a dead or archived animal,
    // or an owner the clinic no longer serves, is not somebody to call.
    Prisma.sql`p."deceased" = false AND p."archivedAt" IS NULL AND c."archivedAt" IS NULL`,
  ];
  if (f.species) parts.push(Prisma.sql`p."species"::text = ${f.species}`);
  if (f.contact === "none") parts.push(Prisma.sql`lc."outcome" IS NULL`);
  if (f.contact === "called") parts.push(Prisma.sql`lc."outcome" = 'CALLED'`);
  if (f.contact === "unreachable") parts.push(Prisma.sql`lc."outcome" = 'UNREACHABLE'`);
  return Prisma.join(parts, " AND ");
}

function joins(now: Date): Prisma.Sql {
  return Prisma.sql`
    FROM "vaccinations" v
    JOIN "pets" p ON p.id = v."petId"
    JOIN "clients" c ON c.id = p."ownerId"
    -- The next booking for this animal, of any kind: an animal coming in
    -- for anything is an animal the vaccine can be given to.
    LEFT JOIN LATERAL (
      SELECT a.id, a."startsAt" FROM "appointments" a
      WHERE a."petId" = v."petId" AND a."clinicId" = v."clinicId"
        AND a."startsAt" >= ${now}
        AND a.status IN ('SCHEDULED', 'CONFIRMED')
      ORDER BY a."startsAt" ASC
      LIMIT 1
    ) appt ON TRUE
    LEFT JOIN LATERAL (
      SELECT r."outcome", r."createdAt", u.name AS "byName" FROM "recall_contacts" r
      LEFT JOIN "users" u ON u.id = r."byId"
      WHERE r."vaccinationId" = v.id
      ORDER BY r."createdAt" DESC
      LIMIT 1
    ) lc ON TRUE`;
}

function orderBy(f: RecallFilters): Prisma.Sql {
  // Booked rows last, whatever the sort: their work is done until the day.
  const booked = Prisma.sql`(appt.id IS NOT NULL) ASC`;
  switch (f.sort) {
    case "pet":
      return Prisma.sql`${booked}, lower(p.name) ASC, v."nextDueAt" ASC, v.id`;
    case "owner":
      return Prisma.sql`${booked}, lower(coalesce(c."lastName", '')) ASC, lower(c."firstName") ASC, v."nextDueAt" ASC, v.id`;
    case "due":
    default:
      // Overdue: the longest-waiting first, the animal most likely lost.
      // Upcoming: the soonest first. Both are "ascending date".
      return Prisma.sql`${booked}, v."nextDueAt" ASC, v.id`;
  }
}

export async function listRecalls(
  f: RecallFilters & { page?: number; perPage?: number },
): Promise<{ items: RecallRow[]; total: number; page: number; perPage: number }> {
  const now = f.now ?? new Date();
  const page = Math.max(1, f.page ?? 1);
  const perPage = f.perPage ?? PAGE_SIZES.LIST;
  const where = f.vaccine
    ? Prisma.sql`${baseWhere(f, now)} AND v.name = ${f.vaccine}`
    : baseWhere(f, now);

  const [items, totals] = await Promise.all([
    prisma.$queryRaw<RecallRow[]>(Prisma.sql`
      SELECT v.id, v.name, v."nextDueAt",
        p.id AS "petId", p.name AS "petName", p.species::text AS species,
        c.id AS "ownerId", c."firstName" AS "ownerFirstName",
        c."lastName" AS "ownerLastName", c.phone AS "ownerPhone", c."preferredLanguage" AS "ownerLanguage",
        appt.id AS "apptId", appt."startsAt" AS "apptStartsAt",
        lc."outcome"::text AS "lastOutcome", lc."createdAt" AS "lastContactAt",
        lc."byName" AS "lastContactBy",
        (SELECT COUNT(*) FROM "recall_contacts" rc WHERE rc."vaccinationId" = v.id)::int AS "contactCount"
      ${joins(now)}
      WHERE ${where}
      ORDER BY ${orderBy(f)}
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `),
    prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      ${joins(now)}
      WHERE ${where}
    `),
  ]);
  return { items, total: totals[0]?.total ?? 0, page, perPage };
}

/**
 * The vaccine names in the current set, most frequent first, for the
 * filter. Read from the set itself so an option can never lead to an
 * empty list.
 */
export async function recallVaccineOptions(
  f: RecallFilters,
): Promise<{ name: string; count: number }[]> {
  const now = f.now ?? new Date();
  return prisma.$queryRaw<{ name: string; count: number }[]>(Prisma.sql`
    SELECT v.name, COUNT(*)::int AS count
    ${joins(now)}
    WHERE ${baseWhere(f, now)}
    GROUP BY v.name
    ORDER BY count DESC, v.name ASC
    LIMIT 40
  `);
}

/** The most the copy-all button puts on a clipboard. */
export const RECALL_COPY_CAP = 500;

function oneOf<T extends string>(list: readonly T[], value: unknown): T | undefined {
  return typeof value === "string" && (list as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * The URL's filters, each checked against its own list: a value nobody
 * offered is dropped rather than passed to SQL. The vaccine name is free
 * text by nature and goes in as a bound parameter.
 */
export function parseRecallFilters(raw: {
  view?: string;
  age?: string;
  vaccine?: string;
  species?: string;
  contact?: string;
  sort?: string;
}): Omit<RecallFilters, "clinicId"> {
  return {
    view: oneOf(RECALL_VIEWS, raw.view) ?? "overdue",
    age: oneOf(RECALL_AGES, raw.age) ?? "recent",
    vaccine: raw.vaccine?.trim() ? raw.vaccine.trim().slice(0, 120) : null,
    species: raw.species && /^[A-Z_]{2,20}$/.test(raw.species) ? raw.species : null,
    contact: oneOf(RECALL_CONTACTS, raw.contact) ?? null,
    sort: oneOf(RECALL_SORTS, raw.sort) ?? "due",
  };
}
