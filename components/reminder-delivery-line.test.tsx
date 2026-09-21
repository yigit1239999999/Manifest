// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";

// The component is a server component: it reads its own translations and the
// clinic's clock rather than taking eight strings as props. Both of those are
// request-scoped lookups, so the test supplies them and then renders the
// resolved element.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: never) =>
    createTranslator({ locale: "tr", messages: tr, namespace }),
}));
vi.mock("@/lib/format-context", () => ({
  getFormatContext: async () => ({ locale: "tr", timeZone: "Europe/Istanbul" }),
}));

import {
  REMINDER_DELIVERY_STATES,
  ReminderDeliveryLine,
  type ReminderDeliveryLineProps,
  type ReminderDeliveryStateName,
} from "@/components/reminder-delivery-line";

const AT = new Date("2026-09-30T06:00:00Z");

// One sample per state, and the compiler is the thing that keeps this
// complete: `Record` over the state names means an eighth state added to
// the component leaves this map failing to typecheck rather than leaving a
// branch untested.
const SAMPLE: Record<ReminderDeliveryStateName, ReminderDeliveryLineProps> = {
  scheduled: { state: "scheduled", sendAt: AT, channel: "SMS" },
  sent: { state: "sent", at: AT, channel: "SMS" },
  failed: {
    state: "failed",
    at: AT,
    channel: "SMS",
    error: "Gönderici adı onay bekliyor",
    attempts: 3,
  },
  optedOut: { state: "optedOut" },
  noPhone: { state: "noPhone" },
  notConfigured: { state: "notConfigured", channel: "SMS" },
  disabled: { state: "disabled", settingsHref: "/settings" },
};

const props = (state: ReminderDeliveryStateName) => SAMPLE[state];

/**
 * Every state says something, and no two of them say the same thing.
 *
 * This is the whole point of the row: `PENDING` used to mean both "goes out
 * tomorrow morning" and "will never go out, because the clinic's
 * notification switch is off". If two states here collapse into one
 * sentence, that ambiguity is back and nothing else in the suite notices —
 * the page still renders, the types still check, and a vet still cannot
 * tell the two apart.
 *
 * Walking `REMINDER_DELIVERY_STATES` rather than listing the seven is what
 * makes it hold for the eighth: a state added without a sentence renders an
 * empty line, and an empty line is the failure this catches.
 */
describe("the delivery sentence", () => {
  it("gives every state its own non-empty sentence", async () => {
    const seen = new Map<string, string>();
    for (const state of REMINDER_DELIVERY_STATES) {
      const { container, unmount } = render(
        await ReminderDeliveryLine(props(state)),
      );
      const text = container.textContent?.trim() ?? "";
      expect(text, `${state} renders nothing`).not.toBe("");
      const twin = [...seen.entries()].find(([, t]) => t === text);
      expect(twin?.[0], `${state} reads the same as ${twin?.[0]}`).toBeUndefined();
      seen.set(state, text);
      unmount();
    }
  });

  it("carries the provider's own words when a send failed", async () => {
    render(await ReminderDeliveryLine(props("failed")));
    // Not a generic "delivery failed": the reason is the only part that
    // tells the clinic whether to wait, to call the provider, or to fix a
    // number.
    expect(screen.getByText(/Gönderici adı onay bekliyor/)).toBeInTheDocument();
    expect(screen.getByText(/3 deneme/)).toBeInTheDocument();
  });

  it("says nothing rather than inventing a reason when the provider gave none", async () => {
    render(
      await ReminderDeliveryLine({ ...SAMPLE.failed, error: null } as ReminderDeliveryLineProps),
    );
    expect(screen.getByText(/Gönderilemedi/)).toBeInTheDocument();
    expect(screen.queryByText(/Gönderici adı/)).not.toBeInTheDocument();
  });
});

/**
 * The switch that turns the whole feature off is the one state whose fix is
 * on another page, and `settings.manage` is not a permission every role has.
 * So the sentence never disappears — hiding it would leave a receptionist
 * with a reminder that quietly does nothing — and only the link does
 * (TEAM.md #30e: say where to go without claiming who the page belongs to).
 */
describe("notifications switched off", () => {
  it("points at the settings page for a role that can open it", async () => {
    render(await ReminderDeliveryLine(props("disabled")));
    expect(
      screen.getByRole("link", { name: tr.reminder.delivery.openSettings }),
    ).toHaveAttribute("href", "/settings");
  });

  it("still states the reason, and says who to ask, without the link", async () => {
    render(
      await ReminderDeliveryLine({ state: "disabled", settingsHref: undefined }),
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/bildirimler kapalı/)).toBeInTheDocument();
    expect(screen.getByText(/yöneticinizle/)).toBeInTheDocument();
  });
});

/**
 * Which language runs longer is measured per surface, not assumed
 * (TEAM.md #32b), and measured on the *rendered* sentence rather than on the
 * stored string — the stored one counts ICU syntax nobody ever sees.
 *
 * Measured here, on the sentences whose length is ours: English is the
 * longer language on this surface, at 80 characters ("Will not be sent:
 * notifications are switched off. Ask your clinic administrator.") against
 * Turkish's 68. So the English row is the one to look at when this changes.
 *
 * The bound is 118 and it is derived, not picked: a 390px viewport leaves
 * 358px inside the row's `p-4`, and at `text-xs` that is about 59
 * characters, so 118 is two rendered lines. Two is what a delivery sentence
 * may take; three turns a list of ten reminders into a page of prose. The
 * failure sentence is excluded because its length belongs to the provider
 * and it is the one line allowed to run on.
 */
describe("longest translation, measured", () => {
  const rendered = (locale: "tr" | "en", messages: typeof tr | typeof en) => {
    const t = createTranslator({
      locale,
      messages,
      namespace: "reminder.delivery",
    });
    const values = { at: "30 Eyl 2026 09:00", channel: "WhatsApp", attempts: 3 };
    return (["scheduled", "sent", "optedOut", "noPhone", "notConfigured"] as const)
      .map((k) => t(k, values).length)
      .concat(t("disabled").length + 1 + t("askAdmin").length);
  };

  it("keeps both languages inside two rendered lines at 390px", () => {
    expect(Math.max(...rendered("tr", tr))).toBeLessThanOrEqual(118);
    expect(Math.max(...rendered("en", en))).toBeLessThanOrEqual(118);
  });

  // The claim in the comment above, under test rather than written down and
  // left to rot (TEAM.md #30g). Whoever makes the Turkish sentences the
  // longer ones fails here and updates the note in the same commit.
  it("finds English the longer language on this surface", () => {
    expect(Math.max(...rendered("en", en))).toBeGreaterThan(
      Math.max(...rendered("tr", tr)),
    );
  });
});
