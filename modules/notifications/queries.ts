import { prisma } from "@/lib/prisma";

export async function listMessagesForAppointment(clinicId: string, appointmentId: string) {
  return prisma.messageLog.findMany({
    where: { clinicId, appointmentId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, kind: true, status: true, channel: true, createdAt: true, error: true, language: true },
  });
}
