// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";

// The component is a server component: it reads its own translations and the
// clinic's clock rather than taking ten strings as props. Both of those are
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
// complete: `Record` over the state names means a new state added to the
// component leaves this map failing to typecheck rather than leaving a
// branch untested.
const SAMPLE: Record<ReminderDeliveryStateName, ReminderDeliveryLineProps> = {
  scheduled: { state: "scheduled", sendAt: AT, channel: "SMS" },
  dueNow: { state: "dueNow", channel: "SMS" },
  sent: { state: "sent", at: AT, channel: "SMS" },
  failedRetrying: { state: "failedRetrying", at: AT, attempts: 1 },
  failedExhausted: { state: "failedExhausted", at: AT, attempts: 3 },
  failedClinic: { state: "failedClinic", at: AT },
  optedOut: { state: "optedOut" },
  neverAsked: { state: "neverAsked" },
  noPhone: { state: "noPhone" },
  notConfigured: { state: "notConfigured", channel: "SMS" },
  petSilenced: { state: "petSilenced" },
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
 * Walking `REMINDER_DELIVERY_STATES` rather than listing the ten is what
 * makes it hold for the eleventh: a state added without a sentence renders
 * an empty line, and an empty line is the failure this catches.
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
});

/**
 * `null` and `false` are not the same answer and must not become the same
 * sentence. The column's own comment says so — "nobody has asked yet" /
 * "agreed" / "refused", and both sides of it have to keep them apart — and
 * until now every reader of the column collapsed them.
 *
 * The vet's job differs, which is the whole reason it matters: a client who
 * refused is a client to leave alone, and a client nobody asked is a phone
 * call. "If I knew, I would pick up the phone."
 */
describe("consent has three values, not two", () => {
  it("tells a refusal apart from a question never asked", async () => {
    const refused = render(await ReminderDeliveryLine(props("optedOut")));
    expect(refused.container.textContent).toMatch(/onayı vermemiş/);
    refused.unmount();

    render(await ReminderDeliveryLine(props("neverAsked")));
    expect(screen.getByText(/hiç sorulmamış/)).toBeInTheDocument();
  });
});

/**
 * The row never prints what the provider said.
 *
 * `MessageLog.error` holds raw transport text, and Netgsm's catalogue reads
 * like "30 - Hatalı kullanıcı adı". The reviewing vet's rule was "long is
 * fine, riddles are not", which also rules out our own first attempt at a
 * short phrase: "given up on" only raises the question of who gave up.
 */
describe("a failure explains itself in plain words", () => {
  it("says what was tried and what happens next while attempts remain", async () => {
    render(await ReminderDeliveryLine(props("failedRetrying")));
    expect(screen.getByText(/tekrar denenecek/)).toBeInTheDocument();
  });

  it("says the attempts are spent, and that a person can still send it", async () => {
    render(await ReminderDeliveryLine(props("failedExhausted")));
    const text = screen.getByText(/operatör kabul etmedi/);
    expect(text).toBeInTheDocument();
    expect(text.textContent).toMatch(/Elle gönderebilirsiniz/);
  });

  // A wrong sender title fails every message the clinic sends. Printing its
  // reason on each row turns one setting into forty rows of the same riddle
  // and sends the vet off to phone forty owners about something no owner
  // did. The row reports the fact; the banner above carries the reason once.
  it("keeps a clinic-wide reason off the row", async () => {
    render(await ReminderDeliveryLine(props("failedClinic")));
    expect(screen.getByText(/Gönderilemedi/)).toBeInTheDocument();
    expect(screen.queryByText(/operatör kabul etmedi/)).not.toBeInTheDocument();
  });
});

/**
 * `SENT` means the provider accepted the message. It does not mean the owner
 * received it, and we have no delivery report that could say so.
 *
 * Written as a test and not only as a comment because the breach will not be
 * in the sentence anyone writes deliberately — it will be in somebody
 * changing a string six months from now because it "reads better". When
 * `deliveredAt` exists, "Ulaştı" is born as a second and separate word and
 * this test is amended on purpose rather than tripped over.
 */
describe("sent is not delivered", () => {
  it.each([
    ["tr", tr, /ulaştı|iletildi|bildirildi/i],
    ["en", en, /delivered|received|reached/i],
  ] as const)("never claims delivery in %s", (locale, messages, banned) => {
    for (const [key, value] of Object.entries(messages.reminder.delivery)) {
      expect(value, `${locale}.${key} implies a delivery report we do not have`)
        .not.toMatch(banned);
    }
  });
});

/**
 * Which language runs longer is measured per surface, not assumed
 * (TEAM.md #32b), and measured on the *rendered* sentence rather than on the
 * stored string — the stored one counts ICU syntax nobody ever sees.
 *
 * The bound is 118 and it is derived, not picked: a 390px viewport leaves
 * 358px inside the row's `p-4`, and at `text-xs` that is about 59
 * characters, so 118 is two rendered lines. Two is what a delivery sentence
 * may take; three turns a list of ten reminders into a page of prose.
 *
 * Nothing is excluded from the bound any more. It used to exempt the
 * failure sentence because its length was the provider's; now the row
 * writes its own words there, so its length is ours and it is measured
 * like the rest.
 */
describe("longest translation, measured", () => {
  const rendered = (locale: "tr" | "en", messages: typeof tr | typeof en) => {
    const t = createTranslator({
      locale,
      messages,
      namespace: "reminder.delivery",
    }) as unknown as (key: string, values: Record<string, unknown>) => string;
    const values = { at: "30 Eyl 2026 09:00", channel: "WhatsApp", attempts: 3 };
    return Object.keys(messages.reminder.delivery)
      .filter((k) => k !== "openSettings" && k !== "askAdmin")
      .map((k) => t(k, values).length);
  };

  it("keeps both languages inside two rendered lines at 390px", () => {
    expect(Math.max(...rendered("tr", tr))).toBeLessThanOrEqual(118);
    expect(Math.max(...rendered("en", en))).toBeLessThanOrEqual(118);
  });

  // Measured, not assumed, and asserted rather than written in a comment
  // and left to rot (TEAM.md #30g). Whoever makes the Turkish sentences the
  // longer ones fails here and updates the claim in the same commit.
  it("finds English the longer language on this surface", () => {
    expect(Math.max(...rendered("en", en))).toBeGreaterThan(
      Math.max(...rendered("tr", tr)),
    );
  });
});
