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
  delivered: { state: "delivered", at: AT, channel: "SMS" },
  awaitingReport: { state: "awaitingReport", at: AT, channel: "SMS" },
  undelivered: { state: "undelivered", at: AT, channel: "SMS" },
  reportExpired: { state: "reportExpired", at: AT, channel: "SMS" },
  failedRetrying: { state: "failedRetrying", at: AT, attempts: 1 },
  failedExhausted: { state: "failedExhausted", attempts: 3 },
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
    expect(screen.getByText(/Tekrar denenecek/)).toBeInTheDocument();
  });

  // A row that had only counted its tries looked the same as one still
  // waiting, with a different number on it -- pm found exactly that on the
  // served build. Saying the automatic sending has stopped is the part
  // that distinguishes them.
  it("says the attempts are spent, and that a person can still send it", async () => {
    render(await ReminderDeliveryLine(props("failedExhausted")));
    const text = screen.getByText(/otomatik gönderim durdu/);
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
    expect(screen.queryByText(/otomatik gönderim durdu/)).not.toBeInTheDocument();
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
 *
 * A word list cannot tell a claim from its denial, and this fired on
 * "it reached nobody" — a sentence that says the opposite of what the
 * rule forbids. The test was kept and the sentence reworded, not the
 * other way round: a narrow guard that occasionally asks you to pick a
 * different word is worth keeping, and one widened until it accepts
 * negations is a guard nobody can reason about (TEAM.md #30e). The rule
 * it enforces is therefore the strict one — these words do not appear
 * here at all, in any grammatical direction.
 *
 * WHAT IT DOES NOT CHECK (#30c): only `reminder.delivery`. The same claim
 * written into a badge label, a banner or the appointment history would
 * pass.
 */
describe("sent is not delivered, and silence is not failure", () => {
  const delivery = (m: typeof tr | typeof en) =>
    m.reminder.delivery as unknown as Record<string, string>;

  /**
   * "Arrived" may be said in exactly one state, and only now that there
   * is a report behind it. This word was deliberately withheld for
   * months so that it would mean something on the day it appeared.
   */
  it.each([
    ["tr", tr, /ulaştı/i],
    ["en", en, /\bdelivered\b/i],
  ] as const)("claims arrival in %s only where a report says so", (loc, m, word) => {
    for (const [key, value] of Object.entries(delivery(m))) {
      if (key === "delivered") continue;
      expect(value, `${loc}.${key} claims an arrival it cannot show`).not.toMatch(word);
    }
    expect(delivery(m).delivered).toMatch(word);
  });

  /**
   * And the rule runs backwards too, which is the half that is easy to
   * lose. `reportExpired` means we stopped hearing, not that it failed;
   * borrowing "did not arrive" there would claim a failure we cannot
   * demonstrate, which is the same sin as claiming a success we cannot
   * demonstrate. Without this the two states fold back together through
   * the wording while the code still has them apart.
   */
  it.each([
    ["tr", tr, /ulaşmadı/i],
    ["en", en, /not received|undelivered/i],
  ] as const)("claims failure in %s only where a report says so", (loc, m, word) => {
    for (const [key, value] of Object.entries(delivery(m))) {
      if (key === "undelivered") continue;
      expect(value, `${loc}.${key} claims a failure it cannot show`).not.toMatch(word);
    }
    expect(delivery(m).undelivered).toMatch(word);
  });

  // Banned outright, in both languages and every state: these read as
  // either "we sent it" or "they got it", and a word that can mean both
  // is the one word this distinction cannot afford.
  //
  // This fired once on "the number could not be reached" -- a phrase
  // about the NUMBER, not about delivery, and unambiguous to any
  // reader. The sentence was reworded to "unreachable" and the guard
  // kept, the same call as the last time one of these tripped on a
  // sentence of ours: a narrow guard that occasionally asks for a
  // different word is worth keeping, and one widened until it can tell
  // context is a guard nobody can reason about.
  it.each([
    ["tr", tr, /iletildi|bildirildi/i],
    ["en", en, /\breceived by\b|\breached\b/i],
  ] as const)("never uses a word that reads both ways in %s", (loc, m, word) => {
    for (const [key, value] of Object.entries(delivery(m))) {
      expect(value, `${loc}.${key} is ambiguous between sent and arrived`).not.toMatch(word);
    }
  });
});

/**
 * Every sentence fits two rendered lines in the row, and the bound is 80
 * characters because that is what was MEASURED — not what was calculated.
 *
 * This replaces a derivation of mine that was wrong in both of its inputs.
 * I had reasoned: 390px viewport, minus the row's `p-4`, leaves 358px, and
 * at `text-xs` that is about 59 characters, so two lines is 118. pm put
 * real Turkish strings into the real element at 390px and measured the
 * container at 260px — the action cluster beside it takes the rest — with
 * 41 characters the widest that stays on one line, 80 the widest that
 * stays on two, and 82 already spilling onto a third. My own
 * `failedRetrying` sentence was 96 characters and rendered on three lines
 * on the served build.
 *
 * So the number here is pm's, arrived at by resizing a browser, and the
 * arithmetic that produced 118 is not repeated anywhere. A bound derived
 * from an unverified premise is a guess wearing a calculation's clothes:
 * it looked rigorous, it passed its own test, and it was wrong by 38
 * characters in the permissive direction.
 *
 * Measured on the *rendered* sentence rather than the stored string — the
 * stored one counts ICU syntax nobody ever sees. The two link labels are
 * excluded: they are appended to a sentence, not sentences themselves.
 *
 * THE NUMBER BELONGS TO ONE CONTAINER AND DOES NOT TRAVEL. 80 is the
 * delivery line inside a reminder row, which is 260px wide at 390px.
 * pm's own check of the same threshold elsewhere: 80 characters in the
 * form's 194px field column runs to FIVE lines. Carrying this number to
 * another surface would repeat, in a new place, exactly the mistake that
 * produced 118 here.
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
    expect(Math.max(...rendered("tr", tr))).toBeLessThanOrEqual(80);
    expect(Math.max(...rendered("en", en))).toBeLessThanOrEqual(80);
  });

  // Which language runs longer is measured per surface, not assumed
  // (TEAM.md #32b), and asserted rather than written in a comment and left
  // to rot (#30g). English is still the longer one here, now by four
  // characters rather than twelve; whoever overtakes it in Turkish fails
  // this and updates the claim in the same commit.
  it("finds English the longer language on this surface", () => {
    expect(Math.max(...rendered("en", en))).toBeGreaterThan(
      Math.max(...rendered("tr", tr)),
    );
  });
});
