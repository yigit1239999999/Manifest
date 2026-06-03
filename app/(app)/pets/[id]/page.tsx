import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  Edit3,
  Plus,
  Stethoscope,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getPetById } from "@/modules/pets/queries";
import { petTimeline } from "@/modules/timeline/queries";
import { archivePetAction } from "@/modules/pets/actions";
import { listVaccinationsForPet } from "@/modules/vaccinations/queries";
import { listPrescriptionsForPet } from "@/modules/prescriptions/queries";
import { listTreatmentsForPet } from "@/modules/treatments/queries";
import { listDiagnosticsForPet } from "@/modules/diagnostics/queries";
import { getClinicCurrency } from "@/modules/clinics/queries";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { DeleteButton } from "@/components/delete-button";
import { SpeciesIcon } from "@/components/species-icon";
import { Timeline } from "@/components/timeline";
import { NoteForm } from "@/components/forms/note-form";
import { VaccinationForm } from "@/components/forms/vaccination-form";
import { PrescriptionForm } from "@/components/forms/prescription-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatDateTime, petAge } from "@/lib/format";

export default async function PetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    timeline,
    vaccinations,
    prescriptions,
    treatments,
    diagnostics,
    currency,
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
    petTimeline(clinicId, id),
    listVaccinationsForPet(clinicId, id, 20),
    listPrescriptionsForPet(clinicId, id, 20),
    listTreatmentsForPet(clinicId, id, 20),
    listDiagnosticsForPet(clinicId, id, 20),
    getClinicCurrency(clinicId),
  ]);

  if (!pet) notFound();

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/pets" label={tCommon("back")} />

      <PageHeader
        title={pet.name}
        description={`${tSpecies(pet.species as never)}${
          pet.breed ? ` · ${pet.breed}` : ""
        } · ${tSex(pet.sex as never)} · ${petAge(pet.birthDate) ?? "—"}`}
      >
        <Link
          href={`/visits/new?petId=${pet.id}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <Stethoscope />
          {t("tabs.visits")}
        </Link>
        <Link
          href={`/appointments/new?petId=${pet.id}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <CalendarClock />
          {(await getTranslations("appointment"))("new")}
        </Link>
        <Link
          href={`/pets/${pet.id}/edit`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <Edit3 />
          {tCommon("edit")}
        </Link>
        <DeleteButton
          action={archivePetAction.bind(null, pet.id)}
          label={tCommon("archive")}
          confirmText={t("archiveConfirm")}
        />
      </PageHeader>

      {pet.deceased && (
        <p className="rounded-lg border border-muted-foreground/30 bg-muted px-3 py-2 text-sm">
          {t("deceased")}: {formatDate(pet.deceasedAt)}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <SpeciesIcon species={pet.species} className="size-5" />
              </span>
              {tCommon("details")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Detail
              label={t("owner")}
              value={
                <Link
                  href={`/clients/${pet.owner.id}`}
                  className="text-primary hover:underline"
                >
                  {pet.owner.firstName} {pet.owner.lastName}
                </Link>
              }
            />
            <Detail label={t("breed")} value={pet.breed || "—"} />
            <Detail label={t("color")} value={pet.color || "—"} />
            <Detail label={t("birthDate")} value={formatDate(pet.birthDate)} />
            <Detail
              label={t("weightKg")}
              value={pet.weightKg != null ? `${pet.weightKg} kg` : "—"}
            />
            <Detail label={t("microchipId")} value={pet.microchipId || "—"} />
            <Detail
              label={t("insuranceProvider")}
              value={pet.insuranceProvider || "—"}
            />
            <Detail label={t("neutered")} value={pet.neutered ? "✓" : "—"} />
            {pet.alerts && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
                <strong>{t("alerts")}: </strong>
                {pet.alerts}
              </div>
            )}
            {pet.notes && (
              <div className="mt-2 rounded-lg bg-muted/40 p-3 text-sm">
                {pet.notes}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t("tabs.vaccinations")}</CardTitle>
              <Badge variant="secondary">{vaccinations.length}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {vaccinations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tVacc("empty")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {vaccinations.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(v.administeredAt)}
                          {v.nextDueAt && ` · → ${formatDate(v.nextDueAt)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <details className="rounded-lg border border-dashed border-border p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  <Plus className="mr-1 inline size-3.5" />
                  {tVacc("new")}
                </summary>
                <div className="mt-3">
                  <VaccinationForm petId={pet.id} />
                </div>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t("tabs.prescriptions")}</CardTitle>
              <Badge variant="secondary">{prescriptions.length}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {prescriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tRx("empty")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {prescriptions.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{p.medicationName}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.dosage} · {p.frequency}
                          {p.durationDays ? ` · ${p.durationDays} days` : ""}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {tStatus(p.status as never)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <details className="rounded-lg border border-dashed border-border p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  <Plus className="mr-1 inline size-3.5" />
                  {tRx("new")}
                </summary>
                <div className="mt-3">
                  <PrescriptionForm petId={pet.id} />
                </div>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{tTreatment("title")}</CardTitle>
              <Badge variant="secondary">{treatments.length}</Badge>
            </CardHeader>
            <CardContent>
              {treatments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tTreatment("empty")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {treatments.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(t.performedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{tDiag("title")}</CardTitle>
              <Badge variant="secondary">{diagnostics.length}</Badge>
            </CardHeader>
            <CardContent>
              {diagnostics.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tDiag("empty")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {diagnostics.map((d) => (
                    <li
                      key={d.id}
                      className="rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <p className="font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(d.performedAt)}
                      </p>
                      {d.result && (
                        <p className="mt-1 text-xs">{d.result}</p>
                      )}
                    </li>
                  ))}
                </ul>
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
        <Timeline events={timeline} currency={currency} />
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
