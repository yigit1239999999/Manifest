import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit3, Plus, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getVisitById } from "@/modules/visits/queries";
import { getInvoiceForVisit } from "@/modules/invoices/queries";
import { vaccinationIntervalSuggestions } from "@/modules/vaccinations/queries";
import {
  archiveVisitAction,
  restoreVisitAction,
} from "@/modules/visits/actions";
import { getClinicCurrency } from "@/modules/clinics/queries";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { DeleteButton } from "@/components/delete-button";
import { RestoreButton } from "@/components/restore-button";
import { VaccinationForm } from "@/components/forms/vaccination-form";
import { PrescriptionForm } from "@/components/forms/prescription-form";
import { TreatmentForm } from "@/components/forms/treatment-form";
import { DiagnosticForm } from "@/components/forms/diagnostic-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Callout } from "@/components/ui/callout";
import { DescriptionList } from "@/components/ui/description-list";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/lib/format";

export default async function VisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const fmt = await getFormatContext();
  const { id } = await params;
  const session = await requireSession();
  const clinicId = session.user.clinicId;

  const [
    visit,
    t,
    tCommon,
    tType,
    tVacc,
    tRx,
    tTreatment,
    tDiag,
    tPet,
    currency,
  ] = await Promise.all([
    getVisitById(clinicId, id),
    getTranslations("visit"),
    getTranslations("common"),
    getTranslations("enum.visitType"),
    getTranslations("vaccination"),
    getTranslations("prescription"),
    getTranslations("treatment"),
    getTranslations("diagnostic"),
    getTranslations("pet"),
    getClinicCurrency(clinicId),
  ]);

  if (!visit) notFound();

  // See the clients page: a button that only produces a refusal is hidden.
  // One permission, both actions: `visits.write` is what the service
  // checks for editing and for archiving alike.
  const canArchive = can(session.user.role, "visits.write");

  // The same rule one level down, for the forms inside the cards. Each
  // clinical record type has its own permission and the service checks it
  // (`modules/<type>/service.ts`), so a role without it can open the form,
  // write a prescription into it, and lose the work on submit. Only the
  // "Add" block goes; the records already there stay readable, because
  // reading them is allowed and a row that disappears reads as data loss
  // (TEAM.md #16c).
  const canAddVaccination = can(session.user.role, "vaccinations.write");
  // Either offer to bill this visit or point at the bill it already
  // has, never both and never neither. Two invoices for one visit are
  // two demands for the same money, and the clinic hears about it from
  // the client; `/invoices/new` asks the same question again, because a
  // link can be bookmarked or opened in a second tab after the first
  // one billed.
  //
  // No `invoices.read` guard around this: every role has that
  // permission, so the condition could never be false and would read
  // as a rule that exists (`app/route-states.test.ts` refuses one, and
  // it caught this one being written).
  const billedAs = await getInvoiceForVisit(clinicId, visit.id);
  const canAddPrescription = can(session.user.role, "prescriptions.write");
  const canAddTreatment = can(session.user.role, "treatments.write");
  const canAddDiagnostic = can(session.user.role, "diagnostics.write");

  // Needs the animal's species, so it follows the load rather than joining
  // it. See `/pets/[id]`, which renders the same form.
  const vaccineIntervals = await vaccinationIntervalSuggestions(
    clinicId,
    visit.pet.species,
  );

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/visits" label={tCommon("back")} />

      <PageHeader
        title={visit.chiefComplaint ?? tType(visit.type as never)}
        description={`${formatDateTime(fmt, visit.visitedAt)} · ${visit.pet.name} · ${visit.client.firstName} ${visit.client.lastName}`}
        badge={<Badge>{tType(visit.type as never)}</Badge>}
      >
        {canArchive && (
          <Link
            href={`/visits/${visit.id}/edit`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <Edit3 />
            {tCommon("edit")}
          </Link>
        )}
        {billedAs ? (
          <Link
            href={`/invoices/${billedAs.id}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <ReceiptText />
            {t("invoicedAs", { number: billedAs.number })}
          </Link>
        ) : (
          // Not offered on an archived visit: it is out of the working
          // record, and raising money against it is not a thing the
          // page should suggest.
          can(session.user.role, "invoices.write") &&
          !visit.archivedAt && (
            <Link
              href={`/invoices/new?visitId=${visit.id}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              <ReceiptText />
              {t("createInvoice")}
            </Link>
          )
        )}
        {canArchive && !visit.archivedAt && (
          <DeleteButton
            // Archived, not deleted: reversible, so it is neither red nor
            // marked with a bin (TEAM.md #25). The notice this puts on the
            // page carries the way back.
            action={archiveVisitAction.bind(null, visit.id)}
            label={tCommon("archive")}
            tone="default"
            mark="archive"
            // Was `tCommon("archive") + "?"`, which asked "Archive?" with no
            // object and read as a stub in both languages.
            confirmText={t("archiveConfirm")}
            description={tCommon("archiveUndoHint")}
          />
        )}
      </PageHeader>

      {visit.archivedAt ? (
        <Callout variant="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {tCommon("archivedOn", {
                date: formatDate(fmt, visit.archivedAt),
              })}
            </span>
            {canArchive && (
              <RestoreButton
                action={restoreVisitAction.bind(null, visit.id)}
                label={tCommon("restore")}
              />
            )}
          </div>
        </Callout>
      ) : (
        // Hidden because its animal or its client is archived, not in its
        // own right. Restoring the visit would put nothing back while they
        // are still archived, so the notice explains instead of offering a
        // button that does nothing (TEAM.md #33).
        (visit.pet.archivedAt || visit.client.archivedAt) && (
          <Callout variant="warning">{t("archivedBySubject")}</Callout>
        )
      )}

      {visit.pet.alerts && (
        <Callout variant="warning" title={tPet("alerts")}>
          {visit.pet.alerts}
        </Callout>
      )}

      {/* See `/invoices/[id]`: a grid item will not shrink below its own
          content, and these four pages share this line. */}
      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("soap")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              className="grid gap-4 sm:grid-cols-2"
              items={[
                {
                  label: t("subjective"),
                  value: visit.subjective,
                  multiline: true,
                },
                {
                  label: t("objective"),
                  value: visit.objective,
                  multiline: true,
                },
                {
                  label: t("assessment"),
                  value: visit.assessment,
                  multiline: true,
                },
                { label: t("plan"), value: visit.plan, multiline: true },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("vitals")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              layout="row"
              items={[
                {
                  label: t("weightKg"),
                  // The unit belongs to the reading, so it is only written
                  // when there is one; the list supplies the "-".
                  value: visit.weightKg != null ? `${visit.weightKg} kg` : null,
                  numeric: true,
                },
                {
                  label: t("temperatureC"),
                  value:
                    visit.temperatureC != null
                      ? `${visit.temperatureC} °C`
                      : null,
                  numeric: true,
                },
                { label: t("heartRateBpm"), value: visit.heartRateBpm, numeric: true },
                {
                  label: t("respiratoryRateBpm"),
                  value: visit.respiratoryRateBpm,
                  numeric: true,
                },
                {
                  label: t("followupAt"),
                  // A follow-up is a day, not a moment — the field stopped
                  // asking for a time, so the card stops printing 00:00.
                  value: formatDate(fmt, visit.followupAt),
                },
                {
                  label: t("totalCost"),
                  value:
                    visit.totalCents != null
                      ? // The visit's own currency, not the clinic's
                        // current setting — the same rule invoices follow.
                        // The fallback covers rows recorded before the
                        // column existed and backfilled to the clinic's
                        // value of that day.
                        formatMoney(fmt, visit.totalCents, visit.currency ?? currency)
                      : null,
                  numeric: true,
                },
                { label: t("vet"), value: visit.vet?.name },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tVacc("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {visit.vaccinations.length === 0 ? (
            <EmptyState size="inline" title={tVacc("empty")} />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visit.vaccinations.map((v) => (
                <li key={v.id} className="text-sm">
                  • <strong>{v.name}</strong>
                  {v.nextDueAt && (
                    <span className="text-muted-foreground">
                      {" "}
                      · → {formatDate(fmt, v.nextDueAt)}
                    </span>
                  )}
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
                <VaccinationForm
                  petId={visit.petId}
                  visitId={visit.id}
                  suggestions={vaccineIntervals}
                />
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tRx("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {visit.prescriptions.length === 0 ? (
            <EmptyState size="inline" title={tRx("empty")} />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visit.prescriptions.map((p) => (
                <li key={p.id} className="text-sm">
                  • <strong>{p.medicationName}</strong> · {p.dosage} ·{" "}
                  {p.frequency}
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
                <PrescriptionForm petId={visit.petId} visitId={visit.id} />
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tTreatment("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {visit.treatments.length === 0 ? (
            <EmptyState size="inline" title={tTreatment("empty")} />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visit.treatments.map((t) => (
                <li key={t.id} className="text-sm">
                  • <strong>{t.name}</strong>
                  {t.code && (
                    <span className="text-muted-foreground"> · {t.code}</span>
                  )}
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
                <TreatmentForm petId={visit.petId} visitId={visit.id} />
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tDiag("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {visit.diagnostics.length === 0 ? (
            <EmptyState size="inline" title={tDiag("empty")} />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visit.diagnostics.map((d) => (
                <li key={d.id} className="text-sm">
                  • <strong>{d.name}</strong>
                  {d.result && (
                    <span className="text-muted-foreground"> · {d.result}</span>
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
                <DiagnosticForm petId={visit.petId} visitId={visit.id} />
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
