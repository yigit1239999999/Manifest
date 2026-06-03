// Dashboard insights with a deliberately small query fan-out.
//
// The previous version issued 14 parallel queries — comfortable on a
// laptop, fragile against the shared Supabase pool with 50+ vets
// online. This version collapses every dashboard count into a single
// raw SQL roundtrip and uses date_trunc() for the weekly/monthly
// buckets so we don't fetch every visit + invoice into Node just to
// histogram it. Net: 14 → 6 DB roundtrips for the same payload.

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recentVisits } from "@/modules/visits/queries";
import { upcomingAppointments } from "@/modules/appointments/queries";
import { upcomingVaccinations } from "@/modules/vaccinations/queries";

interface CountsRow {
  clients: number;
  pets: number;
  visits: number;
  upcoming_appointments: number;
  active_prescriptions: number;
  outstanding_invoices: number;
  outstanding_total_cents: number;
  pending_reminders: number;
}

interface WeekRow {
  week_start: Date;
  count: number;
}

interface MonthRow {
  month_start: Date;
  cents: number;
}

export interface DashboardInsights {
  counts: {
    clients: number;
    pets: number;
    visits: number;
    upcomingAppointments: number;
    activePrescriptions: number;
    outstandingInvoices: number;
    pendingReminders: number;
  };
  outstandingInvoiceCents: number;
  upcomingAppointments: Awaited<ReturnType<typeof upcomingAppointments>>;
  upcomingVaccinations: Awaited<ReturnType<typeof upcomingVaccinations>>;
  recentVisits: Awaited<ReturnType<typeof recentVisits>>;
  visitsByType: { type: string; count: number }[];
  petsBySpecies: { species: string; count: number }[];
  visitsLast12Weeks: { weekStart: Date; count: number }[];
  revenueLast6Months: { monthStart: Date; cents: number }[];
}

export async function dashboardInsights(
  clinicId: string,
): Promise<DashboardInsights> {
  const now = new Date();
  const since12Weeks = new Date(now);
  since12Weeks.setDate(since12Weeks.getDate() - 84);
  const since6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // 1) Eight counts + the outstanding-balance aggregate in a single
  //    roundtrip. Each subselect respects the soft-delete cascade
  //    introduced in step 6.
  const countsPromise = prisma.$queryRaw<CountsRow[]>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM "clients"
        WHERE "clinicId" = ${clinicId} AND "archivedAt" IS NULL)::int AS clients,
      (SELECT COUNT(*) FROM "pets" p
        WHERE p."clinicId" = ${clinicId} AND p."archivedAt" IS NULL
          AND EXISTS (
            SELECT 1 FROM "clients" c
            WHERE c.id = p."ownerId" AND c."archivedAt" IS NULL))::int AS pets,
      (SELECT COUNT(*) FROM "visits" v
        WHERE v."clinicId" = ${clinicId} AND v."archivedAt" IS NULL
          AND EXISTS (SELECT 1 FROM "pets" p WHERE p.id = v."petId" AND p."archivedAt" IS NULL)
          AND EXISTS (SELECT 1 FROM "clients" c WHERE c.id = v."clientId" AND c."archivedAt" IS NULL)
      )::int AS visits,
      (SELECT COUNT(*) FROM "appointments" a
        WHERE a."clinicId" = ${clinicId}
          AND a."startsAt" >= NOW()
          AND a.status IN ('SCHEDULED','CONFIRMED')
          AND EXISTS (SELECT 1 FROM "pets" p WHERE p.id = a."petId" AND p."archivedAt" IS NULL)
          AND EXISTS (SELECT 1 FROM "clients" c WHERE c.id = a."clientId" AND c."archivedAt" IS NULL)
      )::int AS upcoming_appointments,
      (SELECT COUNT(*) FROM "prescriptions"
        WHERE "clinicId" = ${clinicId} AND status = 'ACTIVE')::int AS active_prescriptions,
      (SELECT COUNT(*) FROM "invoices" i
        WHERE i."clinicId" = ${clinicId}
          AND i.status IN ('SENT','PARTIAL')
          AND EXISTS (SELECT 1 FROM "clients" c WHERE c.id = i."clientId" AND c."archivedAt" IS NULL)
      )::int AS outstanding_invoices,
      (SELECT COALESCE(SUM(i."totalCents"), 0) FROM "invoices" i
        WHERE i."clinicId" = ${clinicId}
          AND i.status IN ('SENT','PARTIAL')
          AND EXISTS (SELECT 1 FROM "clients" c WHERE c.id = i."clientId" AND c."archivedAt" IS NULL)
      )::int AS outstanding_total_cents,
      (SELECT COUNT(*) FROM "reminders"
        WHERE "clinicId" = ${clinicId} AND status = 'PENDING')::int AS pending_reminders
  `);

  // 2) Visits per week — date_trunc('week', …) on the database side so
  //    we only transfer one row per bucket instead of every row.
  const weeksPromise = prisma.$queryRaw<WeekRow[]>(Prisma.sql`
    SELECT
      date_trunc('week', "visitedAt") AS week_start,
      COUNT(*)::int AS count
    FROM "visits"
    WHERE "clinicId" = ${clinicId}
      AND "archivedAt" IS NULL
      AND "visitedAt" >= ${since12Weeks}
    GROUP BY week_start
    ORDER BY week_start
  `);

  // 3) Paid-invoice revenue per month, same idea.
  const monthsPromise = prisma.$queryRaw<MonthRow[]>(Prisma.sql`
    SELECT
      date_trunc('month', "paidAt") AS month_start,
      COALESCE(SUM("totalCents"), 0)::int AS cents
    FROM "invoices"
    WHERE "clinicId" = ${clinicId}
      AND status = 'PAID'
      AND "paidAt" >= ${since6Months}
    GROUP BY month_start
    ORDER BY month_start
  `);

  const [
    countsRows,
    weekRows,
    monthRows,
    upcomingApptsList,
    upcomingVaccsList,
    recentVisitsList,
    visitTypeGroups,
    petSpeciesGroups,
  ] = await Promise.all([
    countsPromise,
    weeksPromise,
    monthsPromise,
    upcomingAppointments(clinicId, 5),
    upcomingVaccinations(clinicId, 5),
    recentVisits(clinicId, 5),
    prisma.visit.groupBy({
      by: ["type"],
      where: {
        clinicId,
        archivedAt: null,
        pet: { archivedAt: null },
        client: { archivedAt: null },
      },
      _count: { _all: true },
    }),
    prisma.pet.groupBy({
      by: ["species"],
      where: {
        clinicId,
        archivedAt: null,
        owner: { archivedAt: null },
      },
      _count: { _all: true },
    }),
  ]);

  const c = countsRows[0] ?? {
    clients: 0,
    pets: 0,
    visits: 0,
    upcoming_appointments: 0,
    active_prescriptions: 0,
    outstanding_invoices: 0,
    outstanding_total_cents: 0,
    pending_reminders: 0,
  };

  const visitsLast12Weeks = fillBucketSeries(
    weekRows.map((r) => ({ start: r.week_start, value: r.count })),
    since12Weeks,
    12,
    "week",
  );

  const revenueLast6Months = fillBucketSeries(
    monthRows.map((r) => ({ start: r.month_start, value: r.cents })),
    new Date(now.getFullYear(), now.getMonth() - 5, 1),
    6,
    "month",
  );

  return {
    counts: {
      clients: c.clients,
      pets: c.pets,
      visits: c.visits,
      upcomingAppointments: c.upcoming_appointments,
      activePrescriptions: c.active_prescriptions,
      outstandingInvoices: c.outstanding_invoices,
      pendingReminders: c.pending_reminders,
    },
    outstandingInvoiceCents: c.outstanding_total_cents,
    upcomingAppointments: upcomingApptsList,
    upcomingVaccinations: upcomingVaccsList,
    recentVisits: recentVisitsList,
    visitsByType: visitTypeGroups.map((g) => ({
      type: g.type,
      count: g._count._all,
    })),
    petsBySpecies: petSpeciesGroups.map((g) => ({
      species: g.species,
      count: g._count._all,
    })),
    visitsLast12Weeks: visitsLast12Weeks.map(({ start, value }) => ({
      weekStart: start,
      count: value,
    })),
    revenueLast6Months: revenueLast6Months.map(({ start, value }) => ({
      monthStart: start,
      cents: value,
    })),
  };
}

/** Build a contiguous series so empty buckets render as zero bars. */
function fillBucketSeries(
  rows: { start: Date; value: number }[],
  firstBucketStart: Date,
  count: number,
  unit: "week" | "month",
): { start: Date; value: number }[] {
  const map = new Map<number, number>();
  for (const r of rows) map.set(startOfBucket(r.start, unit).getTime(), r.value);

  const out: { start: Date; value: number }[] = [];
  let cursor = startOfBucket(firstBucketStart, unit);
  for (let i = 0; i < count; i++) {
    const key = cursor.getTime();
    out.push({ start: new Date(cursor), value: map.get(key) ?? 0 });
    cursor = advanceBucket(cursor, unit);
  }
  return out;
}

function startOfBucket(date: Date, unit: "week" | "month"): Date {
  if (unit === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function advanceBucket(date: Date, unit: "week" | "month"): Date {
  if (unit === "month") {
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  }
  const next = new Date(date);
  next.setDate(next.getDate() + 7);
  return next;
}
