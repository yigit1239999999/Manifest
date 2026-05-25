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
}

export async function dashboardInsights(
  clinicId: string,
): Promise<DashboardInsights> {
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
  ]);

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
    visitsByType: visitTypeGroups.map((g) => ({ type: g.type, count: g._count._all })),
    petsBySpecies: petSpeciesGroups.map((g) => ({
      species: g.species,
      count: g._count._all,
    })),
  };
}
