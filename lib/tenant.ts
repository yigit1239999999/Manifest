// Shared tenant-scoping helpers.
//
// Every list / search query must scope by `clinicId`, and most should
// also hide entities whose parent has been archived. These helpers
// centralise that policy so individual queries don't drift apart.

import type { Prisma } from "@/generated/prisma/client";

/** Base scope: the active clinic, not archived. */
export function activeScope(clinicId: string) {
  return { clinicId, archivedAt: null } as const;
}

/**
 * Filters for a Pet record. A pet is hidden if it is archived itself
 * OR if its owner has been archived. `archivedOwner` defaults to false.
 */
export function activePetScope(clinicId: string): Prisma.PetWhereInput {
  return {
    clinicId,
    archivedAt: null,
    owner: { archivedAt: null },
  };
}

/**
 * Filters for a Visit. Hidden when the visit itself, its pet, or its
 * client has been archived.
 */
export function activeVisitScope(clinicId: string): Prisma.VisitWhereInput {
  return {
    clinicId,
    archivedAt: null,
    pet: { archivedAt: null },
    client: { archivedAt: null },
  };
}

/**
 * Appointments inherit the cascade — archived clients/pets disappear
 * from the schedule even though their old records stay in the DB.
 */
export function activeAppointmentScope(
  clinicId: string,
): Prisma.AppointmentWhereInput {
  return {
    clinicId,
    pet: { archivedAt: null },
    client: { archivedAt: null },
  };
}

/** Invoices for non-archived clients. */
export function activeInvoiceScope(clinicId: string): Prisma.InvoiceWhereInput {
  return {
    clinicId,
    client: { archivedAt: null },
  };
}
