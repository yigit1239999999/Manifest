import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listStaff } from "@/modules/staff/queries";
import { setStaffActiveAction } from "@/modules/staff/actions";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { StaffStatusButton } from "@/components/staff-status-button";
import { DataTable } from "@/components/ui/data-table";

export default async function StaffPage() {
  const session = await requireSession();
  // Not a redirect: being told no is a state, and an unexplained
  // relocation to the dashboard is not one.
  if (!can(session.user.role, "users.manage")) return <ForbiddenState />;

  const [t, tRole, tCommon, staff] = await Promise.all([
    getTranslations("staff"),
    getTranslations("enum.role"),
    getTranslations("common"),
    listStaff(session.user.clinicId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Link href="/staff/new" className={buttonVariants()}>
          <Plus />
          {t("new")}
        </Link>
      </PageHeader>

      {staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("empty")}
          description={t("emptyHint")}
        />
      ) : (
        <DataTable
          rows={staff}
          rowKey={(member) => member.id}
          caption={t("title")}
          columns={[
            {
              key: "name",
              header: t("name"),
              cellClassName: "font-medium text-foreground",
              cell: (member) => (
                <>
                  {member.name}
                  {member.id === session.user.id && (
                    <span className="ms-2 text-xs text-muted-foreground">
                      ({t("you")})
                    </span>
                  )}
                  {/* What the hidden columns held, riding along. Five
                      columns do not fit 292px of phone — ux measured that
                      even three do not — and hiding one is only honest
                      when its content is still reachable, which is what
                      this is. Same shape as `/appointments`.

                      `wrap-anywhere` lives here and not on a column of its
                      own: an address is one unbreakable token, and in a
                      45px column it became twenty-six lines. Narrow enough
                      to fit and unreadable is not a fix. */}
                  <div className="mt-1 flex flex-col gap-0.5 text-xs font-normal text-muted-foreground sm:hidden">
                    <span className="wrap-anywhere">{member.email}</span>
                    <span>{tRole(member.role)}</span>
                  </div>
                </>
              ),
            },
            {
              key: "email",
              header: t("email"),
              hideBelow: "sm",
              cellClassName: "text-muted-foreground",
              cell: (member) => member.email,
            },
            {
              key: "role",
              header: t("role"),
              hideBelow: "sm",
              cellClassName: "text-muted-foreground",
              cell: (member) => tRole(member.role),
            },
            {
              key: "status",
              header: t("status"),
              cell: (member) => (
                <StatusBadge
                  kind="staff"
                  status={member.active ? "active" : "inactive"}
                  label={member.active ? t("active") : t("inactive")}
                />
              ),
            },
            {
              key: "actions",
              // Was an empty `<th />`, which left these cells nameless.
              header: tCommon("details"),
              headerHidden: true,
              align: "end",
              cell: (member) =>
                member.id === session.user.id ? null : (
                  <div className="flex justify-end">
                    <StaffStatusButton
                      action={setStaffActiveAction.bind(
                        null,
                        member.id,
                        !member.active,
                      )}
                      active={member.active}
                      label={member.active ? t("deactivate") : t("activate")}
                      name={tCommon("actionFor", {
                        action: member.active ? t("deactivate") : t("activate"),
                        subject: member.name,
                      })}
                      confirmText={
                        member.active ? t("deactivateConfirm") : undefined
                      }
                    />
                  </div>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
