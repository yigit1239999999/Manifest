import Link from "next/link";
import { Pill } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { activePrescriptions } from "@/modules/prescriptions/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";

export default async function PrescriptionsPage() {
  const fmt = await getFormatContext();
  const session = await requireSession();
  const [t, tStatus, tPet, prescriptions] = await Promise.all([
    getTranslations("prescription"),
    getTranslations("enum.prescriptionStatus"),
    getTranslations("pet"),
    activePrescriptions(session.user.clinicId, 100),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {prescriptions.length === 0 ? (
        <EmptyState
          icon={Pill}
          title={t("empty")}
          description={t("emptyHint")}
        />
      ) : (
        <DataTable
          rows={prescriptions}
          rowKey={(p) => p.id}
          caption={t("title")}
          columns={[
            {
              key: "medication",
              header: t("medicationName"),
              cellClassName: "font-medium",
              cell: (p) => p.medicationName,
            },
            {
              key: "pet",
              // Was the hardcoded English string "Pet".
              header: tPet("one"),
              cellClassName: "text-muted-foreground",
              cell: (p) => (
                <Link href={`/pets/${p.pet.id}`} className="hover:underline">
                  {p.pet.name}
                </Link>
              ),
            },
            {
              key: "dosage",
              header: t("dosage"),
              cellClassName: "text-muted-foreground",
              cell: (p) => `${p.dosage} · ${p.frequency}`,
            },
            {
              key: "startedAt",
              header: t("startedAt"),
              cellClassName: "text-muted-foreground",
              cell: (p) => formatDate(fmt, p.startedAt),
            },
            {
              key: "status",
              header: t("status"),
              cell: (p) => (
                <StatusBadge
                  kind="prescription"
                  status={p.status}
                  label={tStatus(p.status as never)}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
