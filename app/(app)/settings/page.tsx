import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenState } from "@/components/ui/forbidden-state";
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
import { VaccineSettingsForm } from "@/components/forms/vaccine-settings-form";
import { VACCINE_CATALOGUE } from "@/lib/vaccines";
import { getVaccineSettings } from "@/modules/vaccinations/queries";
import { setVaccineSettingsAction } from "@/modules/vaccinations/actions";
import { CustomSpeciesDeleteButton } from "@/components/custom-species-delete-button";
import { SpeciesIcon } from "@/components/species-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { NotificationSettingsForm } from "@/components/forms/notification-settings-form";
import { setNotificationSettingsAction } from "@/modules/notifications/actions";
import { getClinicMessagingProfile } from "@/modules/notifications/settings";
import { countClinicInvoices, getClinicSettings } from "@/modules/clinics/queries";
import { setClinicCurrencyAction } from "@/modules/clinics/actions";
import { ClinicSettingsForm } from "@/components/forms/clinic-settings-form";
import { isChannelConfigured, transportName } from "@/lib/messaging/transports";
import { composeAppointmentFor } from "@/lib/messaging/compose";
import { smsSegments } from "@/lib/messaging/sms/segments";

export default async function SettingsPage() {
  const session = await requireSession();
  if (!can(session.user.role, "settings.manage")) return <ForbiddenState />;

  const [
    t,
    tSpecies,
    tVaccination,
    enabled,
    customs,
    profile,
    clinic,
    invoiceCount,
    vaccineSettings,
  ] = await Promise.all([
    getTranslations("settings"),
    getTranslations("enum.species"),
    getTranslations("vaccination"),
    getEnabledSpecies(session.user.clinicId),
    listCustomSpeciesWithUsage(session.user.clinicId),
    getClinicMessagingProfile(session.user.clinicId),
    getClinicSettings(session.user.clinicId),
    countClinicInvoices(session.user.clinicId),
    getVaccineSettings(session.user.clinicId),
  ]);
  if (!profile || !clinic) redirect("/");

  const channel = profile.notifications.channel;
  const configured = isChannelConfigured(channel);
  const transport = transportName(channel);
  const sampleStart = new Date();
  sampleStart.setDate(sampleStart.getDate() + 1);
  sampleStart.setHours(14, 30, 0, 0);
  const sample = (locale: "tr" | "en", kind: "APPOINTMENT_CONFIRMATION" | "APPOINTMENT_REMINDER") =>
    composeAppointmentFor(channel, kind, {
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

      {/* First card on the page: what the clinic *is*, before what it
          sends. The time zone and country join it in 29b, so the shape does
          not change then. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("clinic.title")}</CardTitle>
          <CardDescription>{t("clinic.hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ClinicSettingsForm
            action={setClinicCurrencyAction}
            currency={clinic.currency}
            invoiceCount={invoiceCount}
          />
        </CardContent>
      </Card>

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
          <CardTitle>{t("vaccines.title")}</CardTitle>
          <CardDescription>{t("vaccines.hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <VaccineSettingsForm
            action={setVaccineSettingsAction}
            rows={VACCINE_CATALOGUE.map((vaccine) => ({
              key: vaccine.key,
              species: vaccine.species,
              name: vaccine.name,
              ...(vaccine.bookName ? { bookName: vaccine.bookName } : {}),
              shown: !vaccineSettings.hidden.includes(vaccine.key),
              ...(vaccineSettings.intervals[vaccine.key]
                ? { override: vaccineSettings.intervals[vaccine.key] }
                : {}),
              // What the list would do if this box is left empty, in words.
              // The vaccine we refuse to date says so here too, rather than
              // showing an empty box that looks like an oversight.
              listLabel:
                vaccine.adult.kind === "every"
                  ? t("vaccines.listValue", {
                      interval: tVaccination(`interval.${vaccine.adult.unit}`, {
                        count: vaccine.adult.value,
                      }),
                    })
                  : t("vaccines.listAsks"),
            }))}
            added={vaccineSettings.added}
            speciesOptions={SPECIES.map((s) => ({ value: s, label: tSpecies(s) }))}
            // Bare units, not "1 hafta": these label a selector that sits
            // next to a number box, so the row reads "400 hafta" and not
            // "400 [1 hafta]". The counted form belongs to a sentence.
            unitLabels={{
              week: t("vaccines.unit.week"),
              month: t("vaccines.unit.month"),
              year: t("vaccines.unit.year"),
            }}
            labels={{
              onList: t("vaccines.onList"),
              interval: t("vaccines.interval"),
              intervalHint: t("vaccines.intervalHint"),
              addTitle: t("vaccines.addTitle"),
              addName: t("vaccines.addName"),
              addSpecies: t("vaccines.addSpecies"),
              remove: t("vaccines.remove"),
              save: t("vaccines.save"),
              saved: t("vaccines.saved"),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("notifications.title")}</CardTitle>
          <CardDescription>{t("notifications.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Only the affirmative case lives here. The "not connected"
              notice belongs inside the form, under the channel group, where
              it follows the selection rather than the saved value (ux). */}
          {configured && (
            // The connected case keeps its own accent box rather than
            // becoming a `Callout`: it confirms a working setup, and the
            // component has no affirmative variant (ux withdrew `--success`
            // once the badge measurement showed the fill carries no signal).
            // Raised with ux rather than invented here.
            <p className="rounded-control border border-primary/30 bg-accent px-3 py-2 text-sm text-accent-foreground">
              {t("notifications.providerConnected", {
                channel: t(`notifications.channel_${channel}`),
                transport: transport ?? "",
              })}
              {/* The second half is conditional because the first half only
                  knows about the transport. It used to end "...messages are
                  sent automatically", two lines above a notice inside the
                  form reading "no message is sent on its own" — the same
                  card contradicting itself, and the true one was the one
                  further down. A connected provider is a fact this box owns;
                  whether anything goes out belongs to the master switch, and
                  a claim may not be wider than the thing it is drawn from. */}
              {profile.notifications.whatsapp.enabled && (
                <> {t("notifications.providerConnectedSending")}</>
              )}
            </p>
          )}
          <NotificationSettingsForm
            action={setNotificationSettingsAction}
            settings={profile.notifications}
            timezone={profile.timezone}
            connected={{
              SMS: isChannelConfigured("SMS"),
              WHATSAPP: isChannelConfigured("WHATSAPP"),
            }}
          />
          <details className="rounded-control border border-dashed border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium">{t("notifications.preview")}</summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {(["tr", "en"] as const).map((locale) => (
                <div key={locale} className="flex flex-col gap-3">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("notifications.previewConfirmation")} · {locale.toUpperCase()}
                    </p>
                    <pre className="whitespace-pre-wrap rounded-control bg-muted/40 p-3 font-sans text-xs">
                      {sample(locale, "APPOINTMENT_CONFIRMATION")}
                    </pre>
                    {channel === "SMS" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("notifications.segments", {
                          count: smsSegments(sample(locale, "APPOINTMENT_CONFIRMATION")).segments,
                        })}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("notifications.previewReminder")} · {locale.toUpperCase()}
                    </p>
                    <pre className="whitespace-pre-wrap rounded-control bg-muted/40 p-3 font-sans text-xs">
                      {sample(locale, "APPOINTMENT_REMINDER")}
                    </pre>
                    {channel === "SMS" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("notifications.segments", {
                          count: smsSegments(sample(locale, "APPOINTMENT_REMINDER")).segments,
                        })}
                      </p>
                    )}
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
            <EmptyState size="inline" title={t("species.customEmpty")} />
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
