import Link from "next/link";
import { Plus, Stethoscope } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listVisits } from "@/modules/visits/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export default async function VisitsPage() {
  const session = await requireSession();
  const [t, tVisitType, visits] = await Promise.all([
    getTranslations("visit"),
    getTranslations("enum.visitType"),
    listVisits({ clinicId: session.user.clinicId }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Link href="/visits/new" className={buttonVariants()}>
          <Plus />
          {t("new")}
        </Link>
      </PageHeader>

      {visits.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title={t("empty")}
          description=""
          action={
            <Link href="/visits/new" className={buttonVariants()}>
              <Plus />
              {t("new")}
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("visitedAt")}</th>
                <th className="px-4 py-3 font-medium">{t("type")}</th>
                <th className="px-4 py-3 font-medium">Pet</th>
                <th className="px-4 py-3 font-medium">{t("vet")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visits.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/visits/${v.id}`}
                      className="hover:underline"
                    >
                      {formatDateTime(v.visitedAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {tVisitType(v.type as never)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {v.pet.name} · {v.client.firstName} {v.client.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {v.vet?.name ?? "—"}
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
