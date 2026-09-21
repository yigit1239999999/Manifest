import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, CalendarClock, Edit3, Plus, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getPetById } from "@/modules/pets/queries";
import { petTimeline } from "@/modules/timeline/queries";
import { archivePetAction, restorePetAction } from "@/modules/pets/actions";
import {
  listVaccinationsForPet,
  vaccinationIntervalSuggestions,
} from "@/modules/vaccinations/queries";
import { listPrescriptionsForPet } from "@/modules/prescriptions/queries";
import { listTreatmentsForPet } from "@/modules/treatments/queries";
import { listDiagnosticsForPet } from "@/modules/diagnostics/queries";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { DeleteButton } from "@/components/delete-button";
import { RestoreButton } from "@/components/restore-button";
import { SpeciesIcon } from "@/components/species-icon";
import { Timeline } from "@/components/timeline";
import { NoteForm } from "@/components/forms/note-form";
import { VaccinationForm } from "@/components/forms/vaccination-form";
import { PrescriptionForm } from "@/components/forms/prescription-form";
import { TreatmentForm } from "@/components/forms/treatment-form";
import { DiagnosticForm } from "@/components/forms/diagnostic-form";
import { listStaff } from "@/modules/staff/queries";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DescriptionList } from "@/components/ui/description-list";
import { StatusBadge } from "@/components/ui/status-badge";
import { Callout } from "@/components/ui/callout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  formatDate,
  formatDateOnly,
  formatDateTime,
  petAge,
} from "@/lib/format";

export default async function PetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const fmt = await getFormatContext();
  const { id } = await params;
  const session = await requireSession();
  const clinicId = session.user.clinicId;

  const [
    pet,
    t,
    tCommon,
    tSpecies,
    tSex,
    tTimeline,
    tStatus,
    tVacc,
    tRx,
    tTreatment,
    tDiag,
    tDiagType,
    timeline,
    vaccinations,
    prescriptions,
    treatments,
    diagnostics,
    staff,
  ] = await Promise.all([
    getPetById(clinicId, id),
    getTranslations("pet"),
    getTranslations("common"),
    getTranslations("enum.species"),
    getTranslations("enum.sex"),
    getTranslations("timeline"),
    getTranslations("enum.prescriptionStatus"),
    getTranslations("vaccination"),
    getTranslations("prescription"),
    getTranslations("treatment"),
    getTranslations("diagnostic"),
    getTranslations("enum.diagnosticType"),
    petTimeline(clinicId, id),
    listVaccinationsForPet(clinicId, id, 20),
    listPrescriptionsForPet(clinicId, id, 20),
    listTreatmentsForPet(clinicId, id, 20),
    listDiagnosticsForPet(clinicId, id, 20),
    listStaff(clinicId),
  ]);

  if (!pet) notFound();

  // Needs the species, so it cannot join the batch above. One indexed read
  // of this clinic's own vaccination history; the form shows nothing at all
  // when it comes back empty (backlog 20).
  const vaccineIntervals = await vaccinationIntervalSuggestions(
    clinicId,
    pet.species,
  );

  // See the clients page: a button that only produces a refusal is hidden.
  // Three actions, three different permissions, and the vet techs hold
  // none of them: the service refuses each one, so offering the button
  // only turns a refusal into a click that looks like nothing happened.
  const canEdit = can(session.user.role, "pets.write");
  const canStartVisit = can(session.user.role, "visits.write");
  const canBook = can(session.user.role, "appointments.write");
  const canArchive = can(session.user.role, "pets.archive");
  // And the same again for the forms inside the cards, each with the
  // permission its own service checks — they differ per record type, which
  // is the whole reason one flag would not do: a vet tech may record a
  // vaccination but not a prescription, and a receptionist neither. Before
  // this, either of them could write a prescription out in full and lose it
  // on submit. The records already listed stay visible: reading them is
  // allowed, and a row that vanishes reads as data loss (TEAM.md #16c).
  const canAddVaccination = can(session.user.role, "vaccinations.write");
  const canAddPrescription = can(session.user.role, "prescriptions.write");
  const canAddTreatment = can(session.user.role, "treatments.write");
  const canAddDiagnostic = can(session.user.role, "diagnostics.write");
  // No `canAddNote`. Every role holds `notes.write`, so the guard I wrote
  // here could never have refused anyone — it only told the next reader
  // that some role is turned away, which is not true (TEAM.md #30).

  const vets = staff
    .filter((m) => m.active && (m.role === "VETERINARIAN" || m.role === "ADMIN"))
    .map((m) => ({ id: m.id, name: m.name }));

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/pets" label={tCommon("back")} />

      <PageHeader
        title={pet.name}
        description={`${pet.customSpecies?.name ?? tSpecies(pet.species as never)}${
          pet.breed ? ` · ${pet.breed}` : ""
        } · ${tSex(pet.sex as never)} · ${petAge(fmt, pet.birthDate) ?? "-"}`}
      >
        {canStartVisit && (
          <Link
            href={`/visits/new?petId=${pet.id}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <Stethoscope />
            {(await getTranslations("visit"))("new")}
          </Link>
        )}
        {canBook && (
          <Link
            href={`/appointments/new?petId=${pet.id}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <CalendarClock />
            {(await getTranslations("appointment"))("new")}
          </Link>
        )}
        {canEdit && (
          <Link
            href={`/pets/${pet.id}/edit`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <Edit3 />
            {tCommon("edit")}
          </Link>
        )}
        {canArchive && !pet.archivedAt && (
          <DeleteButton
            // Archived, not deleted: reversible, so it is neither red nor
            // marked with a bin (TEAM.md #25). The notice this puts on the
            // page carries the way back.
            action={archivePetAction.bind(null, pet.id)}
            label={tCommon("archive")}
            tone="default"
            icon={Archive}
            confirmText={t("archiveConfirm")}
            description={tCommon("archiveUndoHint")}
          />
        )}
      </PageHeader>

      {pet.archivedAt ? (
        <Callout variant="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {tCommon("archivedOn", { date: formatDate(fmt, pet.archivedAt) })}
            </span>
            {canArchive && (
              <RestoreButton
                action={restorePetAction.bind(null, pet.id)}
                label={tCommon("restore")}
              />
            )}
          </div>
        </Callout>
      ) : (
        // Archived by its owner rather than in its own right. No restore
        // button here on purpose: restoring this animal would change nothing
        // visible while the owner is still archived, and a button that
        // appears to do nothing is worse than none (TEAM.md #33). The way
        // back is the owner's record, so that is what the notice points at.
        pet.owner.archivedAt && (
          <Callout variant="warning">
            {t("archivedByOwner")}{" "}
            <Link
              href={`/clients/${pet.owner.id}`}
              className="font-medium underline"
            >
              {pet.owner.firstName} {pet.owner.lastName}
            </Link>
          </Callout>
        )
      )}

      {pet.alerts && (
        <Callout variant="warning" title={t("alerts")}>
          {pet.alerts}
        </Callout>
      )}

      {pet.deceased && (
        <p className="rounded-control border border-muted-foreground/30 bg-muted px-3 py-2 text-sm">
          {t("deceased")}: {formatDate(fmt, pet.deceasedAt)}
        </p>
      )}

      {/* See `/invoices/[id]`: a grid item will not shrink below its own
          content, and these four pages share this line. */}
      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-tile bg-accent text-accent-foreground">
                <SpeciesIcon species={pet.species} className="size-5" />
              </span>
              {tCommon("details")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <DescriptionList
              items={[
                {
                  label: t("owner"),
                  value: (
                    <Link
                      href={`/clients/${pet.owner.id}`}
                      className="text-primary hover:underline"
                    >
                      {pet.owner.firstName} {pet.owner.lastName}
                    </Link>
                  ),
                },
                { label: t("breed"), value: pet.breed },
                { label: t("color"), value: pet.color },
                {
                  label: t("birthDate"),
                  value: formatDateOnly(fmt, pet.birthDate),
                },
                {
                  label: t("weightKg"),
                  // The unit belongs to the reading, so it is only written
                  // when there is one; the list supplies the "-".
                  value: pet.weightKg != null ? `${pet.weightKg} kg` : null,
                },
                { label: t("microchipId"), value: pet.microchipId },
                {
                  label: t("insuranceProvider"),
                  value: pet.insuranceProvider,
                },
                {
                  label: t("neutered"),
                  value: pet.neutered ? tCommon("yes") : tCommon("no"),
                },
              ]}
            />
            {pet.notes && (
              <div className="mt-2 rounded-control bg-muted/40 p-3 text-sm">
                {pet.notes}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t("tabs.vaccinations")}</CardTitle>
              <Badge>{vaccinations.length}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {vaccinations.length === 0 ? (
                <EmptyState size="inline" title={tVacc("empty")} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {vaccinations.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between rounded-control border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(fmt, v.administeredAt)}
                          {v.nextDueAt && ` · → ${formatDate(fmt, v.nextDueAt)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {canAddVaccination && (
                <details className="rounded-control border border-dashed border-border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">
                    <Plus className="me-1 inline size-3.5" />
                    {tVacc("new")}
                  </summary>
                  <div className="mt-3">
                    <VaccinationForm petId={pet.id} suggestions={vaccineIntervals} />
                  </div>
                </details>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t("tabs.prescriptions")}</CardTitle>
              <Badge>{prescriptions.length}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {prescriptions.length === 0 ? (
                <EmptyState size="inline" title={tRx("empty")} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {prescriptions.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-control border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{p.medicationName}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.dosage} · {p.frequency}
                          {p.durationDays ? ` · ${tRx("durationShort", { count: p.durationDays })}` : ""}
                        </p>
                      </div>
                      <StatusBadge
                        kind="prescription"
                        status={p.status}
                        label={tStatus(p.status as never)}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {canAddPrescription && (
                <details className="rounded-control border border-dashed border-border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">
                    <Plus className="me-1 inline size-3.5" />
                    {tRx("new")}
                  </summary>
                  <div className="mt-3">
                    <PrescriptionForm petId={pet.id} />
                  </div>
                </details>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{tTreatment("title")}</CardTitle>
              <Badge>{treatments.length}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {treatments.length === 0 ? (
                <EmptyState size="inline" title={tTreatment("empty")} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {treatments.map((tr) => (
                    <li
                      key={tr.id}
                      className="flex items-start justify-between gap-3 rounded-control border border-border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{tr.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(fmt, tr.performedAt)}
                          {tr.performedBy?.name && ` · ${tr.performedBy.name}`}
                          {tr.durationMinutes != null && ` · ${tr.durationMinutes} dk`}
                        </p>
                        {tr.notes && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                            {tr.notes}
                          </p>
                        )}
                      </div>
                      {tr.code && <Badge>{tr.code}</Badge>}
                    </li>
                  ))}
                </ul>
              )}
              {canAddTreatment && (
                <details className="rounded-control border border-dashed border-border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">
                    <Plus className="me-1 inline size-3.5" />
                    {tTreatment("new")}
                  </summary>
                  <div className="mt-3">
                    <TreatmentForm
                      petId={pet.id}
                      vets={vets}
                      defaultVetId={session.user.id}
                    />
                  </div>
                </details>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{tDiag("title")}</CardTitle>
              <Badge>{diagnostics.length}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {diagnostics.length === 0 ? (
                <EmptyState size="inline" title={tDiag("empty")} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {diagnostics.map((d) => (
                    <li
                      key={d.id}
                      className="rounded-control border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{d.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(fmt, d.performedAt)}
                          </p>
                        </div>
                        {/* Both uncoloured: one is a label (which test) and
                            the other is an ordinary wait for the lab, and
                            neither asks the clinic to do anything. The words
                            already tell them apart; a colour here would be
                            spent on nothing (see status-badge.tsx). */}
                        <Badge>
                          {d.result ? tDiagType(d.type as never) : tDiag("resultPending")}
                        </Badge>
                      </div>
                      {d.result && (
                        <p className="mt-2 whitespace-pre-wrap text-xs">
                          {d.result}
                        </p>
                      )}
                      {d.interpretation && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {tDiag("interpretation")}:{" "}
                          </span>
                          {d.interpretation}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canAddDiagnostic && (
                <details className="rounded-control border border-dashed border-border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">
                    <Plus className="me-1 inline size-3.5" />
                    {tDiag("new")}
                  </summary>
                  <div className="mt-3">
                    <DiagnosticForm petId={pet.id} />
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {(await getTranslations("note"))("new")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NoteForm petId={pet.id} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          {tTimeline("title")}
        </h2>
        <Timeline events={timeline} />
      </div>
    </div>
  );
}
