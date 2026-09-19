import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { SPECIES } from "@/modules/pets/schema";
import {
  getEnabledSpecies,
  listCustomSpeciesWithUsage,
} from "@/modules/species/queries";
import {
  deleteCustomSpeciesAction,
  setEnabledSpeciesAction,
} from "@/modules/species/actions";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SpeciesSettingsForm } from "@/components/forms/species-settings-form";
import { CustomSpeciesDeleteButton } from "@/components/custom-species-delete-button";
import { SpeciesIcon } from "@/components/species-icon";

export default async function SettingsPage() {
  const session = await requireSession();
  if (!can(session.user.role, "settings.manage")) redirect("/");

  const [t, tSpecies, enabled, customs] = await Promise.all([
    getTranslations("settings"),
    getTranslations("enum.species"),
    getEnabledSpecies(session.user.clinicId),
    listCustomSpeciesWithUsage(session.user.clinicId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("species.title")}</CardTitle>
          <CardDescription>{t("species.hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SpeciesSettingsForm
            action={setEnabledSpeciesAction}
            species={SPECIES.map((s) => ({ value: s, label: tSpecies(s) }))}
            enabled={enabled}
            saveLabel={t("species.save")}
            savedMessage={t("species.saved")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("species.custom")}</CardTitle>
          <CardDescription>{t("species.customHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {customs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("species.customEmpty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {customs.map((cs) => (
                <li key={cs.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <SpeciesIcon species="OTHER" className="size-4 text-muted-foreground" />
                    {cs.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {t("species.usage", { count: cs.petCount })}
                    </span>
                  </span>
                  <CustomSpeciesDeleteButton
                    action={deleteCustomSpeciesAction.bind(null, cs.id)}
                    label={t("species.delete")}
                    confirmText={t("species.deleteConfirm", { name: cs.name })}
                    disabled={cs.petCount > 0}
                    disabledTitle={t("species.inUse")}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
