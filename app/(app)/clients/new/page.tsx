import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { ClientForm } from "@/components/forms/client-form";

export default async function NewClientPage() {
  const session = await requireSession();
  if (!can(session.user.role, "clients.write")) return <ForbiddenState />;

  const [t, tCommon] = await Promise.all([
    getTranslations("client"),
    getTranslations("common"),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/clients" label={tCommon("back")} />
      <PageHeader title={t("new")} />
      <Card className="p-6">
        <ClientForm />
      </Card>
    </div>
  );
}
