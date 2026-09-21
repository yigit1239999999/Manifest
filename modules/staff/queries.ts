import { prisma } from "@/lib/prisma";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  active: boolean;
}

/** All staff in a clinic, active first then alphabetical. */
export async function listStaff(clinicId: string): Promise<StaffMember[]> {
  return prisma.user.findMany({
    where: { clinicId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      active: true,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

/**
 * The roles that can be recorded as the vet on a visit or an appointment.
 *
 * `ADMIN` is in the list and the reason is the role model, not habit: a
 * user carries exactly one role, so in a single-vet clinic the owner-vet
 * is the `ADMIN` and cannot also be a `VETERINARIAN`. Leaving `ADMIN` out
 * would leave that clinic with nobody to choose, and an empty list where
 * the only vet in the building should be.
 *
 * What this does not fix, so that nobody reads it as fixed: a practice
 * manager who is not a vet also carries `ADMIN` and is still selectable.
 * Telling them apart needs either more than one role per user or a
 * separate "clinician" flag, and neither is worth the change today. The
 * honest summary is that receptionists and vet techs are out and
 * non-clinical administrators are not.
 */
export const CLINICIAN_ROLES = ["VETERINARIAN", "ADMIN"] as const;

/**
 * Who may be recorded as the vet, for this clinic.
 *
 * One source, read by the four screens that offer the choice and by the
 * services that accept it. They used to disagree: the screens listed every
 * active user — a receptionist was offered and could be saved as the vet
 * on a visit — while `/pets/[id]` filtered by role in JavaScript. A screen
 * that filters differently from the server is how "who treated this
 * animal" ends up recorded wrongly, and nobody thinks to correct that
 * field later.
 */
export async function listClinicians(clinicId: string) {
  return prisma.user.findMany({
    where: {
      clinicId,
      active: true,
      role: { in: [...CLINICIAN_ROLES] as never },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Whether this user may be recorded as the vet on this clinic's records. */
export async function isClinician(
  clinicId: string,
  userId: string,
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      clinicId,
      active: true,
      role: { in: [...CLINICIAN_ROLES] as never },
    },
    select: { id: true },
  });
  return user !== null;
}
