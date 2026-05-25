import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { conflict } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { SignUpInput } from "./schema";

export async function createClinicWithOwner(input: SignUpInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("Bu email zaten kullanılıyor.");

  const passwordHash = await bcrypt.hash(input.password, 10);

  const clinic = await prisma.clinic.create({
    data: {
      name: input.clinicName,
      users: {
        create: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: "ADMIN",
        },
      },
    },
    include: { users: true },
  });

  const user = clinic.users[0]!;

  await writeAudit({
    clinicId: clinic.id,
    actorId: user.id,
    action: "SIGNUP",
    entityType: "Clinic",
    entityId: clinic.id,
    metadata: { email: user.email },
  });

  return { clinic, user };
}
