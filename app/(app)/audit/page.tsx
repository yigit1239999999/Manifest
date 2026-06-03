import { History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listAuditEntries } from "@/modules/audit/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { PAGE_SIZES } from "@/lib/pagination";

export default async function AuditPage() {
  const session = await requireSession();
  const [t, tAction, entries] = await Promise.all([
    getTranslations("audit"),
    getTranslations("enum.auditAction"),
    listAuditEntries({
      clinicId: session.user.clinicId,
      take: PAGE_SIZES.AUDIT,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {entries.length === 0 ? (
        <EmptyState icon={History} title={t("empty")} description="" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("when")}</th>
                <th className="px-4 py-3 font-medium">{t("actor")}</th>
                <th className="px-4 py-3 font-medium">{t("action")}</th>
                <th className="px-4 py-3 font-medium">{t("entity")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                  </td>
                  <td className="px-4 py-3">{e.actor?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {tAction(e.action as never)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.entityType}
                    <span className="ml-2 text-xs text-muted-foreground/70">
                      {e.entityId.slice(0, 6)}…
                    </span>
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
