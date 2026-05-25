import { prisma } from "@/lib/prisma";
import { countClients } from "@/modules/clients/queries";
import { countPets } from "@/modules/pets/queries";
import { countVisits, recentVisits } from "@/modules/visits/queries";
import {
  countUpcomingAppointments,
  upcomingAppointments,
} from "@/modules/appointments/queries";
import { countActivePrescriptions } from "@/modules/prescriptions/queries";
import {
  outstandingInvoicesCount,
  outstandingInvoiceTotal,
} from "@/modules/invoices/queries";
import { upcomingVaccinations } from "@/modules/vaccinations/queries";
import { countPendingReminders } from "@/modules/reminders/queries";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
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
  const since12Weeks = new Date(now.getTime() - 12 * WEEK_MS);
  const since6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    clients,
    pets,
    visits,
    upcomingAppts,
    upcomingApptsList,
    upcomingVaccsList,
    activeRx,
    outstandingInv,
    outstandingTotal,
    pendingReminders,
    recentVisitsList,
    visitTypeGroups,
    petSpeciesGroups,
    recentVisitDates,
    recentPaidInvoices,
  ] = await Promise.all([
    countClients(clinicId),
    countPets(clinicId),
    countVisits(clinicId),
    countUpcomingAppointments(clinicId),
    upcomingAppointments(clinicId, 5),
    upcomingVaccinations(clinicId, 5),
    countActivePrescriptions(clinicId),
    outstandingInvoicesCount(clinicId),
    outstandingInvoiceTotal(clinicId),
    countPendingReminders(clinicId),
    recentVisits(clinicId, 5),
    prisma.visit.groupBy({
      by: ["type"],
      where: { clinicId, archivedAt: null },
      _count: { _all: true },
    }),
    prisma.pet.groupBy({
      by: ["species"],
      where: { clinicId, archivedAt: null },
      _count: { _all: true },
    }),
    prisma.visit.findMany({
      where: {
        clinicId,
        archivedAt: null,
        visitedAt: { gte: since12Weeks },
      },
      select: { visitedAt: true },
    }),
    prisma.invoice.findMany({
      where: {
        clinicId,
        status: "PAID",
        paidAt: { gte: since6Months },
      },
      select: { paidAt: true, totalCents: true },
    }),
  ]);

  // Bucket visits into 12 weeks (oldest → newest).
  const weekBuckets = new Map<number, number>();
  const oldestWeek = startOfWeek(since12Weeks);
  for (let i = 0; i < 12; i++) {
    const t = oldestWeek.getTime() + i * WEEK_MS;
    weekBuckets.set(t, 0);
  }
  for (const v of recentVisitDates) {
    const key = startOfWeek(v.visitedAt).getTime();
    if (weekBuckets.has(key)) {
      weekBuckets.set(key, (weekBuckets.get(key) ?? 0) + 1);
    }
  }
  const visitsLast12Weeks = Array.from(weekBuckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([t, count]) => ({ weekStart: new Date(t), count }));

  // Bucket invoices into the last 6 months.
  const monthBuckets = new Map<number, number>();
  for (let i = 0; i < 6; i++) {
    const m = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    monthBuckets.set(m.getTime(), 0);
  }
  for (const inv of recentPaidInvoices) {
    if (!inv.paidAt) continue;
    const key = startOfMonth(inv.paidAt).getTime();
    if (monthBuckets.has(key)) {
      monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + inv.totalCents);
    }
  }
  const revenueLast6Months = Array.from(monthBuckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([t, cents]) => ({ monthStart: new Date(t), cents }));

  return {
    counts: {
      clients,
      pets,
      visits,
      upcomingAppointments: upcomingAppts,
      activePrescriptions: activeRx,
      outstandingInvoices: outstandingInv,
      pendingReminders,
    },
    outstandingInvoiceCents: outstandingTotal,
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
    visitsLast12Weeks,
    revenueLast6Months,
  };
}
