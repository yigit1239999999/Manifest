// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";
// The form refreshes the page after a successful save, so it reads the
// router; nothing here asserts on that.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { NotificationSettingsForm } from "@/components/forms/notification-settings-form";
import { notificationSettingsSchema } from "@/modules/notifications/schema";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/modules/notifications/settings";

// Every field the schema requires must exist in the form.
//
// This is the class of bug, not one instance of it: `channel` was added to
// the schema and never to the form, so the schema failed on the first step
// and *all eight* settings became unsaveable — quietly, for months, with a
// toast that only said "invalid selection". Adding the field fixes today's
// case; this test is what stops the next one.
describe("the form renders every field the schema expects", () => {
  const renderForm = () =>
    render(
      <NextIntlClientProvider locale="tr" messages={tr}>
        <NotificationSettingsForm
          action={async () => ({})}
          settings={DEFAULT_NOTIFICATION_SETTINGS}
          timezone="Europe/Istanbul"
          connected={{ SMS: true, WHATSAPP: false }}
        />
      </NextIntlClientProvider>,
    );

  it("has a control for each key of notificationSettingsSchema", () => {
    const { container } = renderForm();
    const rendered = new Set(
      Array.from(container.querySelectorAll("[name]")).map((el) =>
        el.getAttribute("name"),
      ),
    );

    // The two conditional fields are the exception the rule allows: only one
    // of them belongs to the selected reminder mode, and the schema treats
    // both as optional.
    const conditional = new Set(["hoursBefore", "morningHour"]);
    const missing = Object.keys(notificationSettingsSchema.shape)
      .filter((key) => !conditional.has(key))
      .filter((key) => !rendered.has(key));

    expect(missing).toEqual([]);
  });

  it("offers both channels and marks which one is connected", () => {
    const { container, getByText } = renderForm();
    const channels = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name="channel"]'),
    ).map((el) => el.value);

    expect(channels).toEqual(["SMS", "WHATSAPP"]);
    expect(getByText("Bağlı")).toBeTruthy();
    expect(getByText("Bağlı değil")).toBeTruthy();
  });
});
