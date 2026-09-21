import { prisma } from "@/lib/prisma";
import { notFound, validationFailed } from "@/lib/errors";
import { redact, withAudited } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import type { ActionContext } from "@/lib/action";
import type { VisitInput, VisitIntakeInput } from "./schema";
import { resolveSpecies } from "@/modules/pets/service";
import { writeAudit } from "@/lib/audit";
import { isClinician } from "@/modules/staff/queries";
import { getClinicCurrency } from "@/modules/clinics/queries";

async function resolvePetAndOwner(petId: string, clinicId: string) {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, clinicId, archivedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!pet) throw validationFailed({ petId: ["error.validation.petNotInClinic"] });
  return pet;
}

/**
 * The vet a visit or appointment is recorded against, checked rather than
 * trusted.
 *
 * The screens offer only clinicians (`listClinicians`), and a screen's
 * filter is not a rule — a stale tab, a replayed submit or the next screen
 * someone writes will all get past it. What is at stake is not access:
 * this field says who treated the animal, and nobody goes back to correct
 * it, so a receptionist saved here is wrong in the record for good.
 *
 * Empty is allowed and means "not recorded". That is a real answer, and a
 * better one than a name nobody chose.
 */
/**
 * The currency a visit's total is recorded in, stamped at the time rather
 * than read back later.
 *
 * Same rule as an invoice's, and it was missing here for the same reason
 * it was missing there: the total looked like a plain number. It is not —
 * printed against the clinic's *current* setting, every visit ever
 * recorded is silently restated the first time a clinic switches.
 *
 * Null when there is no total. The two travel together: a currency with
 * no amount says nothing, and an amount with no currency is the defect.
 */
async function stampCurrency(
  total: number | null | undefined,
  clinicId: string,
): Promise<string | null> {
  if (total == null) return null;
  return getClinicCurrency(clinicId);
}

async function resolveVet(
  vetId: string | null | undefined,
  clinicId: string,
): Promise<string | null> {
  const id = vetId?.trim();
  if (!id) return null;
  if (!(await isClinician(clinicId, id)))
    throw validationFailed({ vetId: ["error.validation.vetRequired"] });
  return id;
}

export async function createVisit(input: VisitInput, ctx: ActionContext) {
  requirePermission(ctx.userRole, "visits.write");
  const pet = await resolvePetAndOwner(input.petId, ctx.clinicId);
  const { petId, vetId, total, ...rest } = input;
  // Was `vetId || ctx.userId`: leaving the field blank made whoever filled
  // the form in the vet on the record, so a receptionist writing up a
  // visit became the clinician who performed it. Unrecorded is the honest
  // answer, and the person who typed it is in the audit trail either way.
  const vet = await resolveVet(vetId, ctx.clinicId);
  const currency = await stampCurrency(total, ctx.clinicId);

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "CREATE",
      entityType: "Visit",
      changes: redact(input),
    },
    (tx) =>
      tx.visit.create({
        data: {
          ...rest,
          totalCents: total,
          currency,
          clinicId: ctx.clinicId,
          petId,
          clientId: pet.ownerId,
          vetId: vet,
        },
      }),
  );
}

export async function updateVisit(
  id: string,
  input: VisitInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "visits.write");
  const existing = await prisma.visit.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true },
  });
  if (!existing) throw notFound("visit", id);

  const pet = await resolvePetAndOwner(input.petId, ctx.clinicId);
  const { petId, vetId, total, ...rest } = input;
  const vet = await resolveVet(vetId, ctx.clinicId);
  const currency = await stampCurrency(total, ctx.clinicId);

  return withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "Visit",
      entityId: id,
      changes: redact(input),
    },
    (tx) =>
      tx.visit.update({
        where: { id },
        data: {
          ...rest,
          totalCents: total,
          currency,
          petId,
          clientId: pet.ownerId,
          vetId: vet,
        },
      }),
  );
}

export async function archiveVisit(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "visits.write");
  const existing = await prisma.visit.findFirst({
    where: { id, clinicId: ctx.clinicId, archivedAt: null },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("visit", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "ARCHIVE",
      entityType: "Visit",
      entityId: id,
    },
    (tx) =>
      tx.visit.update({ where: { id }, data: { archivedAt: new Date() } }),
  );
  return existing;
}

export async function restoreVisit(id: string, ctx: ActionContext) {
  requirePermission(ctx.userRole, "visits.write");
  const existing = await prisma.visit.findFirst({
    where: { id, clinicId: ctx.clinicId },
    select: { id: true, petId: true },
  });
  if (!existing) throw notFound("visit", id);

  await withAudited(
    {
      clinicId: ctx.clinicId,
      actorId: ctx.userId,
      action: "RESTORE",
      entityType: "Visit",
      entityId: id,
    },
    (tx) => tx.visit.update({ where: { id }, data: { archivedAt: null } }),
  );
  return existing;
}

/**
 * A visit, and the animal it is about, and that animal's owner, written
 * down in one go.
 *
 * "A form has no order, a walk does." At the counter the owner is
 * standing there and the animal is not on file; on the table the animal
 * is in front of the vet and the owner is a name nobody has asked for.
 * The product used to ask for whichever one they did not have, first,
 * on a screen of its own -- and the vet walked that chain and named
 * what was wrong with it: not the length, the ORDER.
 *
 * ONE STATEMENT, not three writes with redirects between them. Prisma's
 * nested create makes the owner, the animal and the visit inside a
 * single transaction, so a clinic cannot end up holding an animal with
 * no visit because the third form was never reached. Three saves in a
 * row would be the chain again wearing a different coat, which is the
 * thing that was rejected.
 *
 * PERMISSIONS ARE NOT ONE LINE. Writing a visit, creating an animal and
 * creating a client are three different rights, and this asks for
 * exactly the ones it is about to use: a reader who may write visits
 * but not clients gets a refusal rather than a client they were not
 * allowed to make. The appointment side of this walk has a different
 * set -- reception may write clients and animals but not visits -- so
 * that one asks for its own and this must not be copied into it.
 */
export async function createVisitWithIntake(
  input: VisitIntakeInput,
  ctx: ActionContext,
) {
  requirePermission(ctx.userRole, "visits.write");
  const { petId, newPet, vetId, total, ...rest } = input;
  if (newPet) requirePermission(ctx.userRole, "pets.write");
  if (newPet?.owner) requirePermission(ctx.userRole, "clients.write");

  const vet = await resolveVet(vetId, ctx.clinicId);
  const currency = await stampCurrency(total, ctx.clinicId);

  // An animal already on file still has to belong to this clinic, and
  // the visit's `clientId` still comes from the animal rather than from
  // anything the form said.
  const existing = petId ? await resolvePetAndOwner(petId, ctx.clinicId) : null;

  // Outside the transaction on purpose: it may create a clinic-defined
  // species of its own, with its own audit row, and it answers a
  // question ("is this a cat?") that has nothing to do with whether
  // this visit is saved.
  const species = newPet ? await resolveSpecies(newPet.species, ctx) : null;

  // An owner who is already on file has to be in this clinic too --
  // `connect` alone would accept an id from anywhere.
  if (newPet?.ownerId) {
    const owner = await prisma.client.findFirst({
      where: { id: newPet.ownerId, clinicId: ctx.clinicId, archivedAt: null },
      select: { id: true },
    });
    if (!owner)
      throw validationFailed({ ownerId: ["error.validation.ownerNotInClinic"] });
  }

  const result = await prisma.$transaction(async (tx) => {
    // The owner, then the animal, then the visit that points at both.
    //
    // Two statements rather than one nested `visit.create`, and the
    // reason is Prisma rather than taste: a nested relation create
    // cannot be mixed with the scalar `clinicId`/`clientId` this row
    // needs, and the visit's `clientId` is not knowable until the
    // owner's branch has run. What the vet asked for is atomicity --
    // never an animal on file whose visit was never written -- and a
    // transaction is what gives that. Three SAVES with redirects
    // between them would be the chain wearing a different coat; two
    // statements nobody can observe apart are not.
    // The owner's row when it is new, made first so the animal can be
    // written with plain scalars: Prisma refuses to mix a nested
    // relation create with the `clinicId` this multi-tenant row
    // carries, and dropping the scalar would mean connecting the
    // clinic by relation in one branch and not the other.
    const ownerId =
      newPet && !newPet.ownerId
        ? (
            await tx.client.create({
              data: {
                clinicId: ctx.clinicId,
                firstName: newPet.owner!.firstName,
                lastName: newPet.owner!.lastName,
                phone: newPet.owner!.phone,
                notificationsOptIn: newPet.owner!.notificationsOptIn,
              },
              select: { id: true },
            })
          ).id
        : newPet?.ownerId;

    const pet = newPet
      ? await tx.pet.create({
          data: {
            clinicId: ctx.clinicId,
            ownerId: ownerId!,
            name: newPet.name,
            species: species!.species,
            customSpeciesId: species!.customSpeciesId,
            // Not asked on this screen, and absent is the honest
            // record: the enum already has a value for exactly this.
            sex: "UNKNOWN",
          },
          select: { id: true, ownerId: true },
        })
      : existing!;

    const visit = await tx.visit.create({
      data: {
        ...rest,
        totalCents: total,
        currency,
        clinicId: ctx.clinicId,
        vetId: vet,
        petId: pet.id,
        // From the animal, never from the form: the owner of the
        // record is whoever owns the animal.
        clientId: pet.ownerId,
      },
      select: { id: true, petId: true, clientId: true },
    });

    // One row per record that was born, because three records made in
    // one breath are still three records: an audit trail that mentions
    // only the visit cannot answer "where did this client come from".
    if (newPet) {
      await writeAudit(
        {
          clinicId: ctx.clinicId,
          actorId: ctx.userId,
          action: "CREATE",
          entityType: "Pet",
          entityId: pet.id,
          changes: redact(newPet),
          metadata: { via: "visit-intake", visitId: visit.id },
        },
        tx,
      );
    }
    if (newPet?.owner) {
      await writeAudit(
        {
          clinicId: ctx.clinicId,
          actorId: ctx.userId,
          action: "CREATE",
          entityType: "Client",
          entityId: pet.ownerId,
          changes: redact(newPet.owner),
          metadata: { via: "visit-intake", visitId: visit.id },
        },
        tx,
      );
    }
    await writeAudit(
      {
        clinicId: ctx.clinicId,
        actorId: ctx.userId,
        action: "CREATE",
        entityType: "Visit",
        entityId: visit.id,
        changes: redact(input),
      },
      tx,
    );
    return visit;
  });

  // What was actually born, named, so the screen can say it back: three
  // records made in one hand movement is the one cheap moment to catch
  // a mistake -- afterwards it is three places to go and correct.
  return {
    id: result.id,
    createdPet: newPet ? { id: result.petId, name: newPet.name } : null,
    createdClient: newPet?.owner
      ? {
          id: result.clientId,
          firstName: newPet.owner.firstName,
          lastName: newPet.owner.lastName,
        }
      : null,
  };
}
