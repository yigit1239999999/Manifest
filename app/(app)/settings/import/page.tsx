import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { PageHeader } from "@/components/page-header";
import { BackLink } from "@/components/back-link";
import { ImportWizard } from "@/components/import/import-wizard";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { SPECIES } from "@/modules/pets/schema";
import { listCustomSpeciesWithUsage } from "@/modules/species/queries";

export default async function ImportPage() {
  const session = await requireSession();
  // The same gate the service applies (`requireImport`): a whole-clinic
  // import is the administrator's call, like the rest of this section.
  if (!can(session.user.role, "settings.manage")) return <ForbiddenState />;

  const [t, tSettings, tSpecies, customs] = await Promise.all([
    getTranslations("import"),
    getTranslations("settings"),
    getTranslations("enum.species"),
    listCustomSpeciesWithUsage(session.user.clinicId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink href="/settings" label={tSettings("title")} />
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ImportWizard
        // "Other" is not offered as an answer: it is the absence of one,
        // and choosing it for "Muhabbet kuşu" would file a budgie under
        // nothing. A species that fits nowhere is added as the clinic's own.
        builtInSpecies={SPECIES.filter((s) => s !== "OTHER").map((s) => ({
          value: s,
          label: tSpecies(s),
        }))}
        customSpecies={customs.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
