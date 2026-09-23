import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { ImportMapper } from "@/components/import/import-mapper";

/**
 * Reading a clinic's own spreadsheet, and asking about what it cannot tell.
 *
 * Nothing on this screen is saved yet (#16 slice): it reads the file, shows
 * the vet their own headings and their own rows back, and collects the
 * decisions the file does not settle. The screen ends in a summary and no
 * button, because a button that cannot finish is the fault this product
 * spent a day removing from its empty states.
 *
 * Not in the sidebar. Where a vet arrives here from -- a first-run card, an
 * empty list, a settings row -- is a navigation decision and belongs to
 * whoever owns the shape of the first morning, not to the screen itself.
 */
export default async function ImportPage() {
  const session = await requireSession();
  // The same pair the endpoint asks for, in the same order: a row of this
  // file is a client and an animal, so half the permission is no permission.
  if (
    !can(session.user.role, "clients.write") ||
    !can(session.user.role, "pets.write")
  ) {
    return <ForbiddenState />;
  }

  const t = await getTranslations("import");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ImportMapper />
    </div>
  );
}
