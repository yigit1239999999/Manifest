import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { ClientForm } from "@/components/forms/client-form";

export default async function NewClientPage() {
  await requireSession();
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
