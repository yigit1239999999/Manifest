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
import { OPEN_REMINDER_STATUSES } from "@/modules/reminders/queries";
import { getClinicCurrency } from "@/modules/clinics/queries";

interface CountsRow {
  clients: number;
  pets: number;
  visits: number;
  upcoming_appointments: number;
  active_prescriptions: number;
  outstanding_invoices: number;
  outstanding_total_cents: number;
  outstanding_other_currencies: string[];
  open_reminders: number;
}

interface WeekRow {
  week_start: Date;
  count: number;
}

interface MonthRow {
  month_start: Date;
  currency: string;
  cents: number;
  invoices: number;
}

/**
 * Money the clinic has that its own currency cannot express.
 *
 * Reported rather than converted, and the reason belongs in the code
 * because it will be argued with: a rate we picked would be a number the
 * clinic never agreed to, applied to their books. Inventing one is the same
 * class of act as inventing a vaccination interval (TEAM.md #14) — it looks
 * helpful, it is unfalsifiable on screen, and it is wrong in a way nobody
 * can see. So the total stays in its own currency and says so.
 */
export interface MoneyLeftOut {
  currency: string;
  cents: number;
  invoices: number;
}

export interface DashboardInsights {
  counts: {
    clients: number;
    pets: number;
    visits: number;
    upcomingAppointments: number;
    activePrescriptions: number;
    outstandingInvoices: number;
    openReminders: number;
  };
  /** In the clinic's own currency only. See `MoneyLeftOut`. */
  outstandingInvoiceCents: number;
  /** Other currencies present among outstanding invoices, if any. */
  outstandingOtherCurrencies: string[];
  upcomingAppointments: Awaited<ReturnType<typeof upcomingAppointments>>;
  upcomingVaccinations: Awaited<ReturnType<typeof upcomingVaccinations>>;
  recentVisits: Awaited<ReturnType<typeof recentVisits>>;
  visitsByType: { type: string; count: number }[];
  petsBySpecies: { species: string; count: number }[];
  visitsLast12Weeks: { weekStart: Date; count: number }[];
  /** In the clinic's own currency only. See `MoneyLeftOut`. */
  revenueLast6Months: { monthStart: Date; cents: number }[];
  /** What the chart above had to leave out, per currency. */
  revenueOtherCurrencies: MoneyLeftOut[];
}

export async function dashboardInsights(
  clinicId: string,
): Promise<DashboardInsights> {
  // The clinic's own currency, and the only one any total here is allowed to
  // be expressed in. Deduplicated per request by `cache()`, so asking for it
  // here costs nothing the page was not already paying.
  const currency = await getClinicCurrency(clinicId);
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
      -- What is still owed, not what was billed: a partly paid invoice owes
      -- its remainder. GREATEST keeps an overpaid invoice from cancelling
      -- another client's debt, the same way the invoice page floors at zero.
      -- The currency is part of the filter, not an afterthought: adding up
      -- dollars and lira and printing the answer with one symbol is not a
      -- rounding error, it is a made-up number.
      (SELECT COALESCE(SUM(GREATEST(i."totalCents" - COALESCE(paid.cents, 0), 0)), 0) FROM "invoices" i
        LEFT JOIN LATERAL (
          SELECT SUM(p."amountCents") AS cents FROM "payments" p WHERE p."invoiceId" = i.id
        ) paid ON TRUE
        WHERE i."clinicId" = ${clinicId}
          AND i.status IN ('SENT','PARTIAL')
          AND i.currency = ${currency}
          AND EXISTS (SELECT 1 FROM "clients" c WHERE c.id = i."clientId" AND c."archivedAt" IS NULL)
      )::int AS outstanding_total_cents,
      -- Which other currencies are owed in, so the card can say that the
      -- figure above is not the whole of it. The amounts are not summed
      -- here: the metric card has room for the fact, not the size of it.
      (SELECT COALESCE(ARRAY_AGG(DISTINCT i.currency), ARRAY[]::text[]) FROM "invoices" i
        WHERE i."clinicId" = ${clinicId}
          AND i.status IN ('SENT','PARTIAL')
          AND i.currency <> ${currency}
          AND EXISTS (SELECT 1 FROM "clients" c WHERE c.id = i."clientId" AND c."archivedAt" IS NULL)
      ) AS outstanding_other_currencies,
      -- The same set the reminders list shows, taken from the same constant:
      -- the card used to count only PENDING while the list showed PENDING and
      -- SENT, so the number on the card and the number of rows behind it
      -- disagreed.
      (SELECT COUNT(*) FROM "reminders"
        WHERE "clinicId" = ${clinicId}
          AND status::text IN (${Prisma.join([...OPEN_REMINDER_STATUSES])})
      )::int AS open_reminders
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

  // 3) Paid-invoice revenue per month, same idea — but grouped by currency
  //    as well, because a month is not one number when the invoices in it
  //    were issued in different ones. The split into "the chart" and "what
  //    the chart left out" happens below, from these same rows, so it costs
  //    no extra roundtrip.
  const monthsPromise = prisma.$queryRaw<MonthRow[]>(Prisma.sql`
    SELECT
      date_trunc('month', "paidAt") AS month_start,
      currency,
      COALESCE(SUM("totalCents"), 0)::int AS cents,
      COUNT(*)::int AS invoices
    FROM "invoices"
    WHERE "clinicId" = ${clinicId}
      AND status = 'PAID'
      AND "paidAt" >= ${since6Months}
    GROUP BY month_start, currency
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
    outstanding_other_currencies: [],
    open_reminders: 0,
  };

  const visitsLast12Weeks = fillBucketSeries(
    weekRows.map((r) => ({ start: r.week_start, value: r.count })),
    since12Weeks,
    12,
    "week",
  );

  const revenueLast6Months = fillBucketSeries(
    monthRows
      .filter((r) => r.currency === currency)
      .map((r) => ({ start: r.month_start, value: r.cents })),
    new Date(now.getFullYear(), now.getMonth() - 5, 1),
    6,
    "month",
  );

  // Everything the chart could not show, kept per currency and reported as
  // an amount rather than a count: "4 invoices elsewhere" does not say
  // whether the chart is missing pocket change or all of it. In the case
  // that found this, the figure left out was the entire total.
  const leftOut = new Map<string, MoneyLeftOut>();
  for (const row of monthRows) {
    if (row.currency === currency) continue;
    const seen = leftOut.get(row.currency) ?? {
      currency: row.currency,
      cents: 0,
      invoices: 0,
    };
    seen.cents += row.cents;
    seen.invoices += row.invoices;
    leftOut.set(row.currency, seen);
  }

  return {
    counts: {
      clients: c.clients,
      pets: c.pets,
      visits: c.visits,
      upcomingAppointments: c.upcoming_appointments,
      activePrescriptions: c.active_prescriptions,
      outstandingInvoices: c.outstanding_invoices,
      openReminders: c.open_reminders,
    },
    outstandingInvoiceCents: c.outstanding_total_cents,
    outstandingOtherCurrencies: c.outstanding_other_currencies ?? [],
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
    revenueOtherCurrencies: [...leftOut.values()].sort(
      (a, b) => b.cents - a.cents,
    ),
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
