import Link from "next/link";
import { Pill } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { activePrescriptions } from "@/modules/prescriptions/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export default async function PrescriptionsPage() {
  const session = await requireSession();
  const [t, tStatus, prescriptions] = await Promise.all([
    getTranslations("prescription"),
    getTranslations("enum.prescriptionStatus"),
    activePrescriptions(session.user.clinicId, 100),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {prescriptions.length === 0 ? (
        <EmptyState icon={Pill} title={t("empty")} description="" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("medicationName")}</th>
                <th className="px-4 py-3 font-medium">Pet</th>
                <th className="px-4 py-3 font-medium">{t("dosage")}</th>
                <th className="px-4 py-3 font-medium">{t("startedAt")}</th>
                <th className="px-4 py-3 font-medium">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {prescriptions.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.medicationName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <Link
                      href={`/pets/${p.pet.id}`}
                      className="hover:underline"
                    >
                      {p.pet.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.dosage} · {p.frequency}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(p.startedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {tStatus(p.status as never)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
