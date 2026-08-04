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
