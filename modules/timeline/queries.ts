// The timeline aggregates every dated event for a pet or a client into
// a single chronological feed. Each event carries enough data for the
// timeline UI to render it without an extra round trip.

import { prisma } from "@/lib/prisma";

export type TimelineEvent =
  | {
      kind: "visit";
      id: string;
      at: Date;
      title: string;
      summary: string | null;
      vet: { id: string; name: string } | null;
      petId: string;
      visitType: string;
    }
  | {
      kind: "appointment";
      id: string;
      at: Date;
      title: string;
      summary: string | null;
      status: string;
      petId: string;
    }
  | {
      kind: "vaccination";
      id: string;
      at: Date;
      title: string;
      summary: string | null;
      nextDueAt: Date | null;
      petId: string;
    }
  | {
      kind: "prescription";
      id: string;
      at: Date;
      title: string;
      summary: string | null;
      status: string;
      petId: string;
    }
  | {
      kind: "treatment";
      id: string;
      at: Date;
      title: string;
      summary: string | null;
      petId: string;
    }
  | {
      kind: "diagnostic";
      id: string;
      at: Date;
      title: string;
      summary: string | null;
      type: string;
      petId: string;
    }
  | {
      kind: "note";
      id: string;
      at: Date;
      title: string;
      summary: string;
      pinned: boolean;
      author: { id: string; name: string } | null;
      petId: string | null;
      clientId: string | null;
      noteKind: string;
    }
  | {
      kind: "invoice";
      id: string;
      at: Date;
      title: string;
      summary: string | null;
      status: string;
      totalCents: number;
    };

interface TimelineArgs {
  clinicId: string;
  petId?: string | null;
  clientId?: string | null;
  take?: number;
}

export async function petTimeline(
  clinicId: string,
  petId: string,
  take = 100,
): Promise<TimelineEvent[]> {
  return collectTimeline({ clinicId, petId, take });
}

export async function clientTimeline(
  clinicId: string,
  clientId: string,
  take = 100,
): Promise<TimelineEvent[]> {
  return collectTimeline({ clinicId, clientId, take });
}

async function collectTimeline({
  clinicId,
  petId,
  clientId,
  take = 100,
}: TimelineArgs): Promise<TimelineEvent[]> {
  const petFilter = petId ? { petId } : {};
  const clientFilter = clientId ? { clientId } : {};
  // For pet-scoped queries we still pull anything keyed only to the pet;
  // for client-scoped queries we also pull events on any of the client's pets.
  const petScope = clientId ? { pet: { ownerId: clientId } } : petFilter;

  const [
    visits,
    appointments,
    vaccinations,
    prescriptions,
    treatments,
    diagnostics,
    notes,
    invoices,
  ] = await Promise.all([
    prisma.visit.findMany({
      where: { clinicId, archivedAt: null, ...(clientId ? clientFilter : petFilter) },
      orderBy: { visitedAt: "desc" },
      take,
      include: { vet: { select: { id: true, name: true } } },
    }),
    prisma.appointment.findMany({
      where: { clinicId, ...(clientId ? clientFilter : petFilter) },
      orderBy: { startsAt: "desc" },
      take,
    }),
    prisma.vaccination.findMany({
      where: { clinicId, ...(clientId ? petScope : petFilter) },
      orderBy: { administeredAt: "desc" },
      take,
    }),
    prisma.prescription.findMany({
      where: { clinicId, ...(clientId ? petScope : petFilter) },
      orderBy: { startedAt: "desc" },
      take,
    }),
    prisma.treatment.findMany({
      where: { clinicId, ...(clientId ? petScope : petFilter) },
      orderBy: { performedAt: "desc" },
      take,
    }),
    prisma.diagnostic.findMany({
      where: { clinicId, ...(clientId ? petScope : petFilter) },
      orderBy: { performedAt: "desc" },
      take,
    }),
    prisma.note.findMany({
      where: {
        clinicId,
        ...(petId ? { petId } : {}),
        ...(clientId ? { OR: [{ clientId }, { pet: { ownerId: clientId } }] } : {}),
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take,
      include: { author: { select: { id: true, name: true } } },
    }),
    clientId
      ? prisma.invoice.findMany({
          where: { clinicId, clientId },
          orderBy: { issuedAt: "desc" },
          take,
        })
      : Promise.resolve([]),
  ]);

  const events: TimelineEvent[] = [
    ...visits.map<TimelineEvent>((v) => ({
      kind: "visit",
      id: v.id,
      at: v.visitedAt,
      title: v.chiefComplaint ?? "Vizit",
      summary: v.assessment ?? v.plan ?? null,
      vet: v.vet,
      petId: v.petId,
      visitType: v.type,
    })),
    ...appointments.map<TimelineEvent>((a) => ({
      kind: "appointment",
      id: a.id,
      at: a.startsAt,
      title: a.reason ?? "Randevu",
      summary: a.notes ?? null,
      status: a.status,
      petId: a.petId,
    })),
    ...vaccinations.map<TimelineEvent>((v) => ({
      kind: "vaccination",
      id: v.id,
      at: v.administeredAt,
      title: v.name,
      summary: v.notes ?? null,
      nextDueAt: v.nextDueAt,
      petId: v.petId,
    })),
    ...prescriptions.map<TimelineEvent>((p) => ({
      kind: "prescription",
      id: p.id,
      at: p.startedAt,
      title: p.medicationName,
      summary: `${p.dosage} · ${p.frequency}`,
      status: p.status,
      petId: p.petId,
    })),
    ...treatments.map<TimelineEvent>((t) => ({
      kind: "treatment",
      id: t.id,
      at: t.performedAt,
      title: t.name,
      summary: t.notes ?? null,
      petId: t.petId,
    })),
    ...diagnostics.map<TimelineEvent>((d) => ({
      kind: "diagnostic",
      id: d.id,
      at: d.performedAt,
      title: d.name,
      summary: d.result ?? d.interpretation ?? null,
      type: d.type,
      petId: d.petId,
    })),
    ...notes.map<TimelineEvent>((n) => ({
      kind: "note",
      id: n.id,
      at: n.createdAt,
      title: n.kind,
      summary: n.body,
      pinned: n.pinned,
      author: n.author,
      petId: n.petId,
      clientId: n.clientId,
      noteKind: n.kind,
    })),
    ...invoices.map<TimelineEvent>((i) => ({
      kind: "invoice",
      id: i.id,
      at: i.issuedAt,
      title: `Fatura #${i.number}`,
      summary: i.notes ?? null,
      status: i.status,
      totalCents: i.totalCents,
    })),
  ];

  // Pinned notes float to the top; everything else by date desc.
  events.sort((a, b) => {
    const aPinned = a.kind === "note" && a.pinned ? 1 : 0;
    const bPinned = b.kind === "note" && b.pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return b.at.getTime() - a.at.getTime();
  });

  return events.slice(0, take);
}
