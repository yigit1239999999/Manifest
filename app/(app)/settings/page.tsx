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
import { NotificationSettingsForm } from "@/components/forms/notification-settings-form";
import { setNotificationSettingsAction } from "@/modules/notifications/actions";
import { getClinicMessagingProfile } from "@/modules/notifications/settings";
import { isWhatsAppConfigured } from "@/lib/whatsapp/provider";
import { composeAppointmentMessage } from "@/lib/whatsapp/messages";

export default async function SettingsPage() {
  const session = await requireSession();
  if (!can(session.user.role, "settings.manage")) redirect("/");

  const [t, tSpecies, enabled, customs, profile] = await Promise.all([
    getTranslations("settings"),
    getTranslations("enum.species"),
    getEnabledSpecies(session.user.clinicId),
    listCustomSpeciesWithUsage(session.user.clinicId),
    getClinicMessagingProfile(session.user.clinicId),
  ]);
  if (!profile) redirect("/");

  const configured = isWhatsAppConfigured();
  const sampleStart = new Date();
  sampleStart.setDate(sampleStart.getDate() + 1);
  sampleStart.setHours(14, 30, 0, 0);
  const sample = (locale: "tr" | "en", kind: "APPOINTMENT_CONFIRMATION" | "APPOINTMENT_REMINDER") =>
    composeAppointmentMessage(kind, {
      locale,
      clientName: locale === "tr" ? "Ayşe Yılmaz" : "Jane Smith",
      petName: locale === "tr" ? "Sarı" : "Max",
      startsAt: sampleStart,
      durationMinutes: 30,
      visitType: locale === "tr" ? "Aşı" : "Vaccination",
      vetName: session.user.name,
      clinic: profile,
    });

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
          <CardTitle>{t("notifications.title")}</CardTitle>
          <CardDescription>{t("notifications.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p
            className={
              configured
                ? "rounded-lg border border-primary/30 bg-accent px-3 py-2 text-sm text-accent-foreground"
                : "rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            }
          >
            {configured ? t("notifications.providerConnected") : t("notifications.providerMissing")}
          </p>
          <NotificationSettingsForm
            action={setNotificationSettingsAction}
            settings={profile.notifications}
            timezone={profile.timezone}
          />
          <details className="rounded-lg border border-dashed border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium">{t("notifications.preview")}</summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {(["tr", "en"] as const).map((locale) => (
                <div key={locale} className="flex flex-col gap-3">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("notifications.previewConfirmation")} · {locale.toUpperCase()}
                    </p>
                    <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-sans text-xs">
                      {sample(locale, "APPOINTMENT_CONFIRMATION")}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("notifications.previewReminder")} · {locale.toUpperCase()}
                    </p>
                    <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-sans text-xs">
                      {sample(locale, "APPOINTMENT_REMINDER")}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </details>
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
