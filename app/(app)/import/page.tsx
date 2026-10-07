import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { ImportMapper } from "@/components/import/import-mapper";
import { aiMatchAvailable } from "@/modules/import/ai-match";
import { ImportBatches } from "@/components/import/import-batches";
import { listImportBatches } from "@/modules/import/queries";
import { formatDateTime } from "@/lib/format";

/**
 * Reading a clinic's own spreadsheet, and asking about what it cannot tell.
 *
 * The screen reads the file, shows the vet their own headings and their own
 * rows back, collects the decisions the file does not settle, and then --
 * since #40 -- writes them. The two halves are deliberately separate
 * components: the mapping asks what each column is, the saving step asks
 * the questions that only exist once the file is read as people and
 * animals, and shows the counts before anything happens.
 *
 * The list of earlier imports is under both of them, and it is not a log.
 * It is where undo lives after the result card is gone, which is when
 * regret about an import actually arrives.
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

  const canUndo = can(session.user.role, "imports.undo");
  const t = await getTranslations("import");
  const locale = await getLocale();
  const batches = await listImportBatches(session.user.clinicId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ImportMapper aiAvailable={aiMatchAvailable()} canUndo={canUndo} />
      <ImportBatches
        canUndo={canUndo}
        batches={batches.map((batch) => ({
          id: batch.id,
          fileName: batch.fileName,
          summary: t("batchSummary", {
            clients: batch.clientCount,
            pets: batch.petCount,
            vaccinations: batch.vaccinationCount,
          }),
          merged:
            batch.mergedCount > 0 ? t("batchMerged", { count: batch.mergedCount }) : null,
          by: t("batchBy", {
            name: batch.createdBy?.name ?? "",
            date: formatDateTime(locale, batch.createdAt),
          }),
          undone: batch.undoneAt !== null,
        }))}
      />
    </div>
  );
}
