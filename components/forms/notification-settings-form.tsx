"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { FormState } from "@/lib/action";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { CHANNELS, REMINDER_MODES, TIMEZONES } from "@/modules/notifications/schema";
import type { NotificationSettings } from "@/modules/notifications/settings";

interface Props {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  settings: NotificationSettings;
  timezone: string;
}

export function NotificationSettingsForm({ action, settings, timezone }: Props) {
  const t = useTranslations("settings.notifications");
  const [state, formAction] = useActionState(action, {});
  const [mode, setMode] = useState<string>(settings.whatsapp.reminder.mode);

  useEffect(() => {
    if (state.success) toast.success(t("saved"));
    if (state.error) toast.error(state.error);
  }, [state, t]);

  const modeLabel: Record<(typeof REMINDER_MODES)[number], string> = {
    off: t("reminderOff"),
    hoursBefore: t("reminderHoursBefore"),
    morningOf: t("reminderMorningOf"),
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">{t("channel")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
            >
              <input
                type="radio"
                name="channel"
                value={c}
                defaultChecked={settings.channel === c}
                className="mt-0.5 size-4"
              />
              <span className="flex flex-col">
                <span className="font-medium text-foreground">{t(`channel_${c}`)}</span>
                <span className="text-xs text-muted-foreground">{t(`channel_${c}_hint`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={settings.whatsapp.enabled}
          className="mt-0.5 size-4 rounded border-border"
        />
        <span className="font-medium text-foreground">{t("enabled")}</span>
      </label>
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

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
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

      <div className="flex justify-end">
        <SubmitButton>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}
