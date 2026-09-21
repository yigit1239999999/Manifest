import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { ClientForm } from "@/components/forms/client-form";
import { safeNext } from "@/lib/next-param";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "clients.write")) return <ForbiddenState />;

  const [t, tCommon, { next }] = await Promise.all([
    getTranslations("client"),
    getTranslations("common"),
    searchParams,
  ]);
  // Validated here as well as in the action. The page uses it to decide
  // what the form carries, the action to decide where it goes, and
  // neither may trust the other to have looked.
  const errand = safeNext(next);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/clients" label={tCommon("back")} />
      <PageHeader title={t("new")} />
      <Card className="p-6">
        <ClientForm next={errand ?? undefined} />
      </Card>
    </div>
  );
}
