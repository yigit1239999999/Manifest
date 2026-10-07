import { History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getFormatContext } from "@/lib/format-context";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import Link from "next/link";
import { auditEntityNames, listAuditEntries } from "@/modules/audit/queries";
import { AUDIT_ENTITY_TYPES, auditHref, describeAudit, isAuditEntityType } from "@/modules/audit/describe";
import { getClinicCurrency } from "@/modules/clinics/queries";
import { RangeFilterForm } from "@/components/filters/range-filter-form";
import { PageHeader } from "@/components/page-header";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable } from "@/components/ui/data-table";
import { dayRange, formatDateTime, formatMoney, isDayKey } from "@/lib/format";
import { PAGE_SIZES } from "@/lib/pagination";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string; to?: string }>;
}) {
  const fmt = await getFormatContext();
  const session = await requireSession();
  if (!can(session.user.role, "audit.read")) return <ForbiddenState />;

  const params = await searchParams;
  // Values that name nothing are dropped rather than sent to the database:
  // an old or hand-edited link should be a wider list, not an error page.
  const type = isAuditEntityType(params.type) ? params.type : undefined;
  const from = isDayKey(params.from) ? params.from : undefined;
  const to = isDayKey(params.to) ? params.to : undefined;
  const fromRange = from ? dayRange(from, fmt.timeZone) : null;
  const toRange = to ? dayRange(to, fmt.timeZone) : null;

  const [t, tAction, tCommon, entries, currency] = await Promise.all([
    getTranslations("audit"),
    getTranslations("enum.auditAction"),
    getTranslations("common"),
    listAuditEntries({
      clinicId: session.user.clinicId,
      entityType: type,
      from: fromRange?.from ?? null,
      to: toRange ? new Date(toRange.to.getTime() + 1) : null,
      take: PAGE_SIZES.AUDIT,
    }),
    getClinicCurrency(session.user.clinicId),
  ]);
  const names = await auditEntityNames(session.user.clinicId, entries);
  const filtered = Boolean(type || from || to);

  /**
   * The row's sentence: what happened, to which record, in words. Money
   * is formatted in the invoice's own currency where the invoice is still
   * there to say which.
   */
  const sentence = (e: (typeof entries)[number]) => {
    const said = describeAudit(e);
    const name = names.get(`${e.entityType}:${e.entityId}`);
    const amount =
      said.amountCents !== undefined ? formatMoney(fmt, said.amountCents, name?.currency ?? currency) : "";
    switch (said.key) {
      case "paymentRecorded":
        return t("sentence.paymentRecorded", { amount });
      case "paymentVoided":
        return t("sentence.paymentVoided", { amount });
      case "invoiceCreated":
        return t("sentence.invoiceCreated", { amount });
      case "invoiceIssued":
        return t("sentence.invoiceIssued");
      case "invoiceVoided":
        return t("sentence.invoiceVoided");
      case "importCreated":
        return t("sentence.importCreated", said.values);
      case "importUndone":
        return t("sentence.importUndone", said.values);
      default:
        return t("sentence.generic", {
          entity: isAuditEntityType(e.entityType) ? t(`entityType.${e.entityType}`) : e.entityType,
          action: tAction(e.action as never),
        });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <RangeFilterForm
        action="/audit"
        labels={{ from: t("filterFrom"), to: t("filterTo"), apply: t("filterApply"), clear: tCommon("clearFilter") }}
        from={from}
        to={to}
        select={{
          name: "type",
          label: t("filterType"),
          value: type,
          allLabel: tCommon("all"),
          options: AUDIT_ENTITY_TYPES.map((value) => ({ value, label: t(`entityType.${value}`) })),
        }}
        clearHref="/audit"
        showClear={filtered}
      />

      {entries.length === 0 ? (
        filtered ? (
          <EmptyState icon={History} title={tCommon("emptyFiltered")} description={tCommon("emptyFilteredHint")} />
        ) : (
          <EmptyState
            icon={History}
            title={t("empty")}
            description={t("emptyHint")}
          />
        )
      ) : (
        <DataTable
          rows={entries}
          rowKey={(e) => e.id}
          caption={t("title")}
          // Stacked on a phone: what happened first, then when and who.
          narrow="stack"
          columns={[
            {
              key: "what",
              header: t("what"),
              stack: "title",
              cell: (e) => {
                const name = names.get(`${e.entityType}:${e.entityId}`);
                const href = name || e.entityType === "ImportBatch" ? auditHref(e.entityType, e.entityId) : null;
                // The generic sentence already names the record's kind, so
                // the second line carries only its name, when it has one.
                const generic = describeAudit(e).key === "generic";
                const kind = isAuditEntityType(e.entityType) ? t(`entityType.${e.entityType}`) : e.entityType;
                return (
                  <span className="flex min-w-0 flex-col">
                    <span className="break-words font-medium text-foreground">{sentence(e)}</span>
                    <span className="break-words text-xs text-muted-foreground">
                      {generic ? null : href && !name ? (
                        <Link href={href} className="text-primary underline-offset-2 hover:underline">
                          {kind}
                        </Link>
                      ) : (
                        kind
                      )}
                      {name && !generic ? " · " : ""}
                      {name &&
                        (href ? (
                          <Link href={href} className="text-primary underline-offset-2 hover:underline">
                            {name.label}
                          </Link>
                        ) : (
                          name.label
                        ))}
                    </span>
                  </span>
                );
              },
            },
            {
              key: "actor",
              header: t("actor"),
              stack: "meta",
              cell: (e) => e.actor?.name ?? "-",
            },
            {
              key: "when",
              header: t("when"),
              stack: "meta-end",
              cellClassName: "text-muted-foreground",
              cell: (e) => formatDateTime(fmt, e.createdAt),
            },
          ]}
        />
      )}
    </div>
  );
}
