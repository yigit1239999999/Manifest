import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { listStaff } from "@/modules/staff/queries";
import { setStaffActiveAction } from "@/modules/staff/actions";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { StaffStatusButton } from "@/components/staff-status-button";

export default async function StaffPage() {
  const session = await requireSession();
  if (!can(session.user.role, "users.manage")) {
    redirect("/");
  }

  const [t, tRole, staff] = await Promise.all([
    getTranslations("staff"),
    getTranslations("enum.role"),
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
        <EmptyState icon={Users} title={t("empty")} description="" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("name")}</th>
                <th className="px-4 py-3 font-medium">{t("email")}</th>
                <th className="px-4 py-3 font-medium">{t("role")}</th>
                <th className="px-4 py-3 font-medium">{t("status")}</th>
                <th className="px-4 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map((member) => {
                const isSelf = member.id === session.user.id;
                return (
                  <tr key={member.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {member.name}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({t("you")})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {member.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tRole(member.role)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={member.active ? "primary" : "outline"}>
                        {member.active ? t("active") : t("inactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <div className="flex justify-end">
                          <StaffStatusButton
                            action={setStaffActiveAction.bind(
                              null,
                              member.id,
                              !member.active,
                            )}
                            active={member.active}
                            label={
                              member.active ? t("deactivate") : t("activate")
                            }
                            confirmText={
                              member.active ? t("deactivateConfirm") : undefined
                            }
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
