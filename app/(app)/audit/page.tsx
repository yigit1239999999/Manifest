import { History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listAuditEntries } from "@/modules/audit/queries";
import { PageHeader } from "@/components/page-header";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { formatDateTime } from "@/lib/format";
import { PAGE_SIZES } from "@/lib/pagination";

export default async function AuditPage() {
  const fmt = await getFormatContext();
  const session = await requireSession();
  if (!can(session.user.role, "audit.read")) return <ForbiddenState />;

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
        <EmptyState
          icon={History}
          title={t("empty")}
          description={t("emptyHint")}
        />
      ) : (
        <DataTable
          rows={entries}
          rowKey={(e) => e.id}
          caption={t("title")}
          columns={[
            {
              key: "when",
              header: t("when"),
              cellClassName: "text-muted-foreground",
              cell: (e) => formatDateTime(fmt, e.createdAt),
            },
            {
              key: "actor",
              header: t("actor"),
              cell: (e) => e.actor?.name ?? "-",
            },
            {
              key: "action",
              header: t("action"),
              cell: (e) => (
                <Badge>{tAction(e.action as never)}</Badge>
              ),
            },
            {
              key: "entity",
              header: t("entity"),
              cellClassName: "text-muted-foreground",
              cell: (e) => (
                <>
                  {e.entityType}
                  <span className="ms-2 text-xs text-muted-foreground/70">
                    {e.entityId.slice(0, 6)}…
                  </span>
                </>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
