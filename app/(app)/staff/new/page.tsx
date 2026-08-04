import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { StaffForm } from "@/components/forms/staff-form";

export default async function NewStaffPage() {
  const session = await requireSession();
  if (!can(session.user.role, "users.manage")) {
    redirect("/");
  }

  const [t, tCommon] = await Promise.all([
    getTranslations("staff"),
    getTranslations("common"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/staff" label={tCommon("back")} />
      <PageHeader title={t("new")} description={t("subtitle")} />
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <StaffForm />
      </div>
    </div>
  );
}
