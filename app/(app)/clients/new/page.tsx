import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { ClientForm } from "@/components/forms/client-form";

export default async function NewClientPage() {
  await requireSession();
  const [t, tCommon] = await Promise.all([
    getTranslations("client"),
    getTranslations("common"),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/clients" label={tCommon("back")} />
      <PageHeader title={t("new")} />
      <ClientForm />
    </div>
  );
}
