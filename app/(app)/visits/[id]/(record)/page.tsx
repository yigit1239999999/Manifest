import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit3, Plus, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { implausibleWeight } from "@/modules/pets/plausible-weight";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getVisitById } from "@/modules/visits/queries";
import { countPets } from "@/modules/pets/queries";
import { clientBalance, getInvoiceForVisit } from "@/modules/invoices/queries";
import { OwnerBalance } from "@/components/invoices/owner-balance";
import { vaccineOffersForPet } from "@/modules/vaccinations/queries";
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
import { DiagnosticReadButton } from "@/components/diagnostic-read-button";
import { markDiagnosticReadAction } from "@/modules/diagnostics/actions";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Callout } from "@/components/ui/callout";
import { IntakeReceipt } from "@/components/intake-receipt";
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
  formatDecimal,
  formatMoney,
  toDateInput,
} from "@/lib/format";
import { ownerLabel } from "@/lib/pet-label";

export default async function VisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const fmt = await getFormatContext();
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
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
    tInvoiceStatus,
    tCheck,
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
    getTranslations("enum.invoiceStatus"),
    getTranslations("allergyCheck"),
    getClinicCurrency(clinicId),
  ]);

  if (!visit) notFound();

  // What the save that landed here made, if it made anything.
  //
  // Two values and nothing else; anything unrecognised is ignored
  // rather than reported, because a link somebody edited is not an
  // error worth a screen. The words are assembled from the RECORD --
  // the address carries only which sentence applies.
  const born =
    created === "animal,owner" ? "owner" : created === "animal" ? "pet" : null;
  // Only on the one morning it is true: the clinic's first findable
  // animal. Asked only when something was created, so no ordinary
  // visit pays for the count.
  const firstEver = born ? (await countPets(clinicId)) === 1 : false;

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
  // The permission the service demands, asked here so the screen does
  // not offer a press the server refuses.
  const canInterpret = can(session.user.role, "diagnostics.interpret");
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
  // The owner's open balance rides in the same round trip: they are at the
  // counter, and "they still owe for March" is said now or not at all.
  const [billedAs, ownerBalance] = await Promise.all([
    getInvoiceForVisit(clinicId, visit.id),
    clientBalance(clinicId, visit.client.id),
  ]);
  const canAddPrescription = can(session.user.role, "prescriptions.write");
  const canAddTreatment = can(session.user.role, "treatments.write");

  // Needs the animal's species, so it follows the load rather than joining
  // it. See `/pets/[id]`, which renders the same form.
  const { offers: vaccineOffers, priorDoses, openSeries } = await vaccineOffersForPet(
    clinicId,
    visit.petId,
    visit.pet.species,
  );

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/visits" label={tCommon("back")} />

      <PageHeader
        // Which animal first, then why it came. A heading of "Aşı" alone
        // named a kind of visit, not a record: the vet reading a day's
        // visits could not tell one from the next without scrolling.
        // The appointment record heads itself the same way. The name is
        // plain text here; the way to the animal is the link in the
        // detail list (`app/record-exits.test.ts`).
        title={`${visit.pet.name} · ${visit.chiefComplaint ?? tType(visit.type as never)}`}
        description={formatDateTime(fmt, visit.visitedAt)}
        // The only page whose heading is free text: it carries the
        // vet's own words for why the animal came. The whole of them
        // is the first row of the SOAP card below, which is what lets
        // the heading be clipped at all.
        titleIsFreeText
        // The badge names the kind of visit, and the title falls back to
        // the same words when nobody wrote a complaint -- so a wellness
        // check with no complaint read "Genel kontrol" twice, side by
        // side, which is the shape of a placeholder rather than of a
        // record (pm, on a first-run clinic). So it only appears when the
        // title carries a complaint instead.
        badge={
          visit.chiefComplaint ? <Badge>{tType(visit.type as never)}</Badge> : undefined
        }
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
            {/* The status, and it is not decoration. "Invoiced as
                INV-2026-001" reads as "this is settled", and the
                invoice may be a draft — raised on screen, never sent,
                never collected. The point of the money chain is "who
                has not paid", so showing a draft as finished is the
                silent wrong answer it exists to remove. */}
            <StatusBadge
              kind="invoice"
              status={billedAs.status}
              label={tInvoiceStatus(billedAs.status as never)}
            />
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

      {born && (
        <IntakeReceipt
          said={[
            born === "owner"
              ? t("createdAnimalOwner", {
                  pet: visit.pet.name,
                  owner: ownerLabel(visit.client),
                })
              : t("createdAnimal", { pet: visit.pet.name }),
            // Only where a number could have been taken and was not:
            // the owner was written down here, on this form, and the
            // box beside the field said there is none yet.
            born === "owner" && !visit.client.phone
              ? t("createdPhoneLater")
              : null,
          ]
            .filter(Boolean)
            .join(" ")}
          next={
            firstEver
              ? t("createdFindAgain", { pet: visit.pet.name })
              : undefined
          }
        />
      )}

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

      {/* The record's own particulars, above the examination.
          
          They used to sit at the bottom of a card headed "vitals",
          which is how a vet reading for a temperature met the vet's
          name, the follow-up date and the total instead. A heading is
          a promise about what is under it, and four readings do not
          cover seven rows (ux).
          
          Full width and first: this is what the visit IS -- who saw
          the animal, whose animal, what it came to, what it cost --
          and the examination is what was found. Reading order follows
          that, which is also the order a vet opening somebody else's
          visit asks for it in (ui, after measuring the alternatives).
          
          `common.details`, the same key the animal's page uses for
          the same job. NOT `client.details`, which reads "İletişim
          bilgileri" and would be taken silently. */}
      <Card>
        <CardHeader>
          <CardTitle>{tCommon("details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DescriptionList
            // Stacked, label over value (pm C9). In `row` layout each pair
            // pushed its value to the end of a 300px cell, so at 1366 the
            // label sat at the left of the cell and the value at the far
            // right, nearer the next label than its own. Stacked, the two
            // are read as one; the grid keeps the card to two short rows.
            //
            // A grid so a pair stays a pair. In one column across 976px
            // the label sits at the left edge and the value at the
            // right, and reading one of them is a journey the eye makes
            // five times down the card (ui measured it; it is the same
            // fault this team named on the first-run screen a few hours
            // earlier). Cells about a third of that put the value back
            // beside its label.
            //
            // Wrapping only -- no `grid-flow-col`, no column placement.
            // A grid that reorders shows one sequence to the eye and
            // reads another to a screen reader, and "identity first"
            // would then be true only for people who can see it (ux).
            className="grid gap-x-8 gap-y-4 sm:grid-cols-3 xl:grid-cols-5"
            items={[
              // The animal and the owner first, and this is error
              // catching rather than tidiness: identity is what a
              // reader checks before anything else. A vet who has
              // landed on the wrong visit -- a stale link, a back
              // button, two tabs -- finds out by looking at whose
              // animal it is. With identity last, under a money total,
              // that discovery is late, and everything read before it
              // was read about the wrong animal (ux).
              {
                label: tPet("one"),
                value: (
                  <Link
                    href={`/pets/${visit.pet.id}`}
                    className="text-primary hover:underline"
                  >
                    {visit.pet.name}
                  </Link>
                ),
              },
              {
                label: tPet("owner"),
                value: (
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <Link
                      href={`/clients/${visit.client.id}`}
                      className="text-primary hover:underline"
                    >
                      {ownerLabel(visit.client)}
                    </Link>
                    <OwnerBalance clientId={visit.client.id} balance={ownerBalance} fmt={fmt} compact />
                  </span>
                ),
              },
              { label: t("vet"), value: visit.vet?.name },
              // The appointment this visit answered, when it was started
              // from one; absent otherwise rather than a "-" row.
              ...(visit.appointment
                ? [
                    {
                      label: t("appointmentLink"),
                      value: (
                        <Link
                          href={`/appointments/${visit.appointment.id}`}
                          className="text-primary hover:underline"
                        >
                          {formatDateTime(fmt, visit.appointment.startsAt)}
                        </Link>
                      ),
                    },
                  ]
                : []),
              {
                label: t("followupAt"),
                // A follow-up is a day, not a moment -- the field stopped
                // asking for a time, so the card stops printing 00:00.
                value: formatDate(fmt, visit.followupAt),
              },
              {
                label: t("totalCost"),
                value:
                  visit.totalCents != null
                    ? // The visit's own currency, not the clinic's current
                      // setting -- the same rule invoices follow. The
                      // fallback covers rows recorded before the column
                      // existed and backfilled to the clinic's value of
                      // that day.
                      formatMoney(fmt, visit.totalCents, visit.currency ?? currency)
                    : null,
                numeric: true,
              },
            ]}
          />
        </CardContent>
      </Card>

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
                  // The complaint's home, and the reason the heading may
                  // now be cut short. A title clipped at three lines is a
                  // presentation decision only while the whole of it is
                  // somewhere else on the page; without that it quietly
                  // becomes a decision about the record (ux).
                  //
                  // Labelled with the words the vet typed it under, so
                  // the thing they are looking for is named the same on
                  // both screens. Above the anamnesis because that is
                  // what it is: what the owner said, before what was
                  // found.
                  label: t("chiefComplaint"),
                  value: visit.chiefComplaint,
                },
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

        {/* `self-start`, and without it this fix leaves a hole where the
            defect was. A grid item stretches to the tallest row by
            default, so the vitals card was being pulled to the SOAP
            card's 416px; with three rows gone it would hold four
            readings over ~100px of nothing, which reads as a card that
            failed to load rather than one with four numbers in it
            (ui, measured). Shrinking to its content is the whole
            point of taking the other rows out. */}
        <Card className="self-start">
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
                  // Marked when it is out of range for the species, so a
                  // 42 kg cat saved past the form's question still stands
                  // out on the record the dose is read from.
                  value:
                    visit.weightKg != null ? (
                      implausibleWeight(visit.pet.species, String(visit.weightKg)) ? (
                        <span className="font-semibold text-warning">
                          {formatDecimal(fmt, visit.weightKg)} kg ·{" "}
                          {t("weightCheck")}
                        </span>
                      ) : (
                        `${formatDecimal(fmt, visit.weightKg)} kg`
                      )
                    ) : null,
                  numeric: true,
                },
                {
                  label: t("temperatureC"),
                  value:
                    visit.temperatureC != null
                      ? `${formatDecimal(fmt, visit.temperatureC, 1)} °C`
                      : null,
                  numeric: true,
                },
                { label: t("heartRateBpm"), value: visit.heartRateBpm, numeric: true },
                {
                  label: t("respiratoryRateBpm"),
                  value: visit.respiratoryRateBpm,
                  numeric: true,
                },
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
            // Open on a vaccination visit that has none yet: recording the
            // dose is what this visit is for, and it should not sit one
            // click away behind a closed summary.
            <details
              open={visit.type === "VACCINATION" && visit.vaccinations.length === 0}
              className="rounded-control border border-dashed border-border p-3 text-sm"
            >
              <summary className="cursor-pointer font-medium">
                <Plus className="me-1 inline size-3.5" />
                {tVacc("new")}
              </summary>
              <div className="mt-3">
                <VaccinationForm
                  petId={visit.petId}
                  visitId={visit.id}
                  offers={vaccineOffers}
                  priorDoses={priorDoses}
                  openSeries={openSeries}
                  birthDate={visit.pet.birthDate ? toDateInput(visit.pet.birthDate) : null}
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
                  {p.frequency}{" "}
                  <Link
                    href={`/print/prescriptions/${p.id}`}
                    className="ms-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                    aria-label={`${tRx("print")}: ${p.medicationName}`}
                  >
                    {tRx("print")}
                  </Link>
                  {p.overrideReason && (
                    <p className="ms-3 text-xs text-destructive">
                      {tCheck("overridden", { reason: p.overrideReason })}
                    </p>
                  )}
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
                <PrescriptionForm
                  petId={visit.petId}
                  visitId={visit.id}
                  alerts={visit.pet.alerts}
                />
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
                  {t.overrideReason && (
                    <p className="ms-3 text-xs text-destructive">
                      {tCheck("overridden", { reason: t.overrideReason })}
                    </p>
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
                <TreatmentForm
                  petId={visit.petId}
                  visitId={visit.id}
                  alerts={visit.pet.alerts}
                />
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
                  {/* Here as well as on the animal, and for the same
                      reason rather than for symmetry: a vet opening the
                      visit reads the result here, and a confirmation
                      that lives on another page is one they will not go
                      to. Same condition, same one tap. */}
                  {/* On its own line, clear of the result's text, and
                      that is a touch-placement rule rather than a
                      layout preference. Results are read one-handed on
                      a phone between patients, so a control sitting in
                      the flow of the text a thumb is dragging is a
                      control that gets pressed by the drag. Size is
                      not the question here; where it sits is.

                      The read state keeps the same position so the row
                      does not move when it changes. */}
                  {d.externalLab && d.result && (
                    <div className="mt-2">
                      {d.readAt ? (
                        <span className="text-xs text-muted-foreground">
                          {tDiag("readOnAnon", {
                            at: formatDateTime(fmt, d.readAt),
                          })}
                        </span>
                      ) : (
                        canInterpret && (
                          <DiagnosticReadButton
                            action={markDiagnosticReadAction.bind(null, d.id)}
                            label={tDiag("markRead")}
                            name={tDiag("markReadName", { subject: d.name })}
                          />
                        )
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* No permission check: see the pet page. Every role may
              enter a result, so a guard here would refuse nobody. */}
          <details className="rounded-control border border-dashed border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              <Plus className="me-1 inline size-3.5" />
              {tDiag("new")}
            </summary>
            <div className="mt-3">
              <DiagnosticForm petId={visit.petId} visitId={visit.id} />
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
