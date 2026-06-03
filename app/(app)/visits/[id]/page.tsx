import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit3, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getVisitById } from "@/modules/visits/queries";
import { archiveVisitAction } from "@/modules/visits/actions";
import { getClinicCurrency } from "@/modules/clinics/queries";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { DeleteButton } from "@/components/delete-button";
import { VaccinationForm } from "@/components/forms/vaccination-form";
import { PrescriptionForm } from "@/components/forms/prescription-form";
import { TreatmentForm } from "@/components/forms/treatment-form";
import { DiagnosticForm } from "@/components/forms/diagnostic-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  formatDateTime,
  formatMoney,
} from "@/lib/format";

export default async function VisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    getClinicCurrency(clinicId),
  ]);

  if (!visit) notFound();

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/visits" label={tCommon("back")} />

      <PageHeader
        title={visit.chiefComplaint ?? tType(visit.type as never)}
        description={`${formatDateTime(visit.visitedAt)} · ${visit.pet.name} · ${visit.client.firstName} ${visit.client.lastName}`}
      >
        <Badge variant="secondary">{tType(visit.type as never)}</Badge>
        <Link
          href={`/visits/${visit.id}/edit`}
          className={buttonVariants({ variant: "secondary" })}
        >
          <Edit3 />
          {tCommon("edit")}
        </Link>
        <DeleteButton
          action={archiveVisitAction.bind(null, visit.id)}
          label={tCommon("archive")}
          confirmText={tCommon("archive") + "?"}
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("soap")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <SoapBlock label={t("subjective")} value={visit.subjective} />
            <SoapBlock label={t("objective")} value={visit.objective} />
            <SoapBlock label={t("assessment")} value={visit.assessment} />
            <SoapBlock label={t("plan")} value={visit.plan} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("vitals")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Row
              label={t("weightKg")}
              value={visit.weightKg != null ? `${visit.weightKg} kg` : "—"}
            />
            <Row
              label={t("temperatureC")}
              value={visit.temperatureC != null ? `${visit.temperatureC} °C` : "—"}
            />
            <Row
              label={t("heartRateBpm")}
              value={visit.heartRateBpm ?? "—"}
            />
            <Row
              label={t("respiratoryRateBpm")}
              value={visit.respiratoryRateBpm ?? "—"}
            />
            <Row
              label={t("followupAt")}
              value={visit.followupAt ? formatDateTime(visit.followupAt) : "—"}
            />
            <Row
              label={t("totalCost")}
              value={
                visit.totalCents != null
                  ? formatMoney(visit.totalCents, currency)
                  : "—"
              }
            />
            <Row label={t("vet")} value={visit.vet?.name ?? "—"} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tVacc("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {visit.vaccinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tVacc("empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visit.vaccinations.map((v) => (
                <li key={v.id} className="text-sm">
                  • <strong>{v.name}</strong>
                  {v.nextDueAt && (
                    <span className="text-muted-foreground">
                      {" "}
                      · → {formatDateTime(v.nextDueAt)}
                    </span>
                  )}
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
              <VaccinationForm petId={visit.petId} visitId={visit.id} />
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tRx("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {visit.prescriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tRx("empty")}</p>
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
          <details className="rounded-lg border border-dashed border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              <Plus className="mr-1 inline size-3.5" />
              {tRx("new")}
            </summary>
            <div className="mt-3">
              <PrescriptionForm petId={visit.petId} visitId={visit.id} />
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tTreatment("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {visit.treatments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tTreatment("empty")}
            </p>
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
          <details className="rounded-lg border border-dashed border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              <Plus className="mr-1 inline size-3.5" />
              {tTreatment("new")}
            </summary>
            <div className="mt-3">
              <TreatmentForm petId={visit.petId} visitId={visit.id} />
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tDiag("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {visit.diagnostics.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tDiag("empty")}</p>
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
          <details className="rounded-lg border border-dashed border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              <Plus className="mr-1 inline size-3.5" />
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

function SoapBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <p className="whitespace-pre-wrap text-sm">{value || "—"}</p>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
