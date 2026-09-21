"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { FormState } from "@/lib/action";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { CHANNELS, REMINDER_MODES, TIMEZONES } from "@/modules/notifications/schema";
import type { NotificationSettings } from "@/modules/notifications/settings";
import { ActionForm, useActionForm } from "@/components/forms/action-form";
import { cn } from "@/lib/utils";

interface Props {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  settings: NotificationSettings;
  timezone: string;
  /** Whether each channel has a working provider behind it, read on the server. */
  connected: Record<(typeof CHANNELS)[number], boolean>;
}

export function NotificationSettingsForm({
  action,
  settings,
  timezone,
  connected,
}: Props) {
  const t = useTranslations("settings.notifications");
  const form = useActionForm(action, {});
  const { state } = form;
  const [mode, setMode] = useState<string>(settings.whatsapp.reminder.mode);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>(settings.channel);
  const [enabled, setEnabled] = useState(settings.whatsapp.enabled);

  useEffect(() => {
    if (state.success) toast.success(t("saved"));
  }, [state.success, t]);

  const modeLabel: Record<(typeof REMINDER_MODES)[number], string> = {
    off: t("reminderOff"),
    hoursBefore: t("reminderHoursBefore"),
    morningOf: t("reminderMorningOf"),
  };

  return (
    <ActionForm form={form} className="flex flex-col gap-5">

      {/* The channel decides what every automatic message costs and who it
          can reach at all: SMS is charged per segment and goes to any number,
          WhatsApp needs the customer to use the app and a template to be
          approved. That is the clinic's commercial decision, so it is a radio
          group rather than a select — a select hides the alternative. */}
      <fieldset className="flex flex-col gap-2 border-b border-border pb-5">
        <legend className="mb-1 text-sm font-medium text-foreground">
          {t("channel")}
        </legend>
        {CHANNELS.map((c) => (
          <label key={c} className="flex items-start gap-3 text-sm">
            <input
              type="radio"
              name="channel"
              value={c}
              checked={channel === c}
              onChange={() => setChannel(c)}
              className="mt-0.5 size-4"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-foreground">
                {t(`channel_${c}`)}
                {/* Deliberately not a StatusBadge: that component carries the
                    lifecycle state of a *record*, and this is the state of a
                    delivery route. Making them look alike would say they are
                    the same kind of thing. */}
                <span className="ms-2 text-xs text-muted-foreground">
                  {connected[c] ? t("channelConnected") : t("channelNotConnected")}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`channel_${c}_hint`)}
              </span>
            </span>
          </label>
        ))}
        {state.fieldErrors?.channel && (
          <p className="text-xs font-medium text-destructive">
            {state.fieldErrors.channel[0]}
          </p>
        )}
        {/* An absence, not an error: the setting is valid, the provider
            behind it is missing. `live` because this appears when the
            selection changes, after the page has mounted. */}
        {!connected[channel] && (
          <Callout variant="info" live>
            {t("providerMissing", { channel: t(`channel_${channel}`) })}
          </Callout>
        )}
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 size-4 rounded border-border"
        />
        <span className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{t("enabled")}</span>
          <span className="text-xs text-muted-foreground">{t("enabledHint")}</span>
        </span>
      </label>
      {/* Dimmed, never disabled, while automatic messages are off: a clinic
          setting itself up wants to get the timings right and then switch
          them on, and disabling the controls forbids that order. */}
      {!enabled && <Callout variant="info" live>{t("disabledNotice")}</Callout>}
      <div
        className={cn(
          "flex flex-col gap-5",
          !enabled && "opacity-60 transition-opacity",
        )}
      >
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="confirmOnBooking"
          defaultChecked={settings.whatsapp.confirmOnBooking}
          className="mt-0.5 size-4 rounded border-border"
        />
        <span className="text-foreground">{t("confirmOnBooking")}</span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">{t("reminder")}</legend>
        {state.fieldErrors?.reminderMode && (
          <p className="text-xs font-medium text-destructive">
            {state.fieldErrors.reminderMode[0]}
          </p>
        )}
        {REMINDER_MODES.map((m) => (
          <label key={m} className="flex items-center gap-3 text-sm">
            <input
              type="radio"
              name="reminderMode"
              value={m}
              checked={mode === m}
              onChange={() => setMode(m)}
              className="size-4"
            />
            <span>{modeLabel[m]}</span>
          </label>
        ))}
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          {mode === "hoursBefore" && (
            <Field label={t("hoursBefore")} error={state.fieldErrors?.hoursBefore}>
              <Input
                type="number"
                min="1"
                max="168"
                name="hoursBefore"
                defaultValue={settings.whatsapp.reminder.hoursBefore}
              />
            </Field>
          )}
          {mode === "morningOf" && (
            <Field label={t("morningHour")} error={state.fieldErrors?.morningHour}>
              <Input
                type="number"
                min="0"
                max="23"
                name="morningHour"
                defaultValue={settings.whatsapp.reminder.morningHour}
              />
            </Field>
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-control border border-border p-3">
        <legend className="px-1 text-sm font-medium text-foreground">{t("remindersTitle")}</legend>
        <p className="text-xs text-muted-foreground">{t("remindersHint")}</p>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="remindersEnabled"
            defaultChecked={settings.whatsapp.reminders.enabled}
            className="mt-0.5 size-4 rounded border-border"
          />
          <span className="text-foreground">{t("remindersEnabled")}</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("remindersDaysBefore")} error={state.fieldErrors?.remindersDaysBefore}>
            <Input
              type="number"
              min="0"
              max="60"
              name="remindersDaysBefore"
              defaultValue={settings.whatsapp.reminders.daysBefore}
            />
          </Field>
        </div>
      </fieldset>

      <Field label={t("timezone")} error={state.fieldErrors?.timezone} hint={t("timezoneHint")}>
        <Select name="timezone" defaultValue={timezone}>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </Field>

      </div>

      <div className="flex justify-end">
        <SubmitButton>{t("save")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
