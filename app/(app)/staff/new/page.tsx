import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { Card } from "@/components/ui/card";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { StaffForm } from "@/components/forms/staff-form";

export default async function NewStaffPage() {
  const session = await requireSession();
  if (!can(session.user.role, "users.manage")) return <ForbiddenState />;

  const [t, tCommon] = await Promise.all([
    getTranslations("staff"),
    getTranslations("common"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/staff" label={tCommon("back")} />
      <PageHeader title={t("new")} description={t("subtitle")} />
      <Card className="p-6">
        <StaffForm />
      </Card>
    </div>
  );
}
