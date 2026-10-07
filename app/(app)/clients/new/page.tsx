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
  searchParams: Promise<{ next?: string; name?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.user.role, "clients.write")) return <ForbiddenState />;

  const [t, tCommon, { next, name }] = await Promise.all([
    getTranslations("client"),
    getTranslations("common"),
    searchParams,
  ]);
  // Validated here as well as in the action. The page uses it to decide
  // what the form carries, the action to decide where it goes, and
  // neither may trust the other to have looked.
  const errand = safeNext(next);
  const typed = name?.slice(0, 80).trim() || undefined;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* See `pets/new`: on an errand the way back is the form that
          sent them here, which may itself be another errand. */}
      <BackLink href={errand ?? "/clients"} label={tCommon("back")} />
      <PageHeader title={t("new")} />
      <Card className="p-6">
        <ClientForm
          next={errand ?? undefined}
          // Split at the FIRST space, not the last: the counter types
          // what the person says, and in "Ayşe Çelik" the given name
          // comes first. Both halves land in editable boxes, and the
          // surname is optional now anyway, so a wrong guess costs a
          // keystroke where retyping the whole name costs the thing
          // the vet called a door.
          defaultFirstName={typed?.split(" ")[0]}
          defaultLastName={typed?.split(" ").slice(1).join(" ") || undefined}
        />
      </Card>
    </div>
  );
}
