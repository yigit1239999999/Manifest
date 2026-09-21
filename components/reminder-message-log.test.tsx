// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: never) =>
    createTranslator({ locale: "tr", messages: tr, namespace }),
}));
vi.mock("@/lib/format-context", () => ({
  getFormatContext: async () => ({ locale: "tr", timeZone: "Europe/Istanbul" }),
}));

import {
  ReminderMessageLog,
  type ReminderMessageEntry,
} from "@/components/reminder-message-log";

const suppressed = (
  sentInstead: ReminderMessageEntry["sentInstead"],
): ReminderMessageEntry => ({
  status: "SUPPRESSED",
  createdAt: new Date("2026-09-30T06:00:00Z"),
  channel: "SMS",
  body: "Sayın Hâl Sahibi, Zeytin için aşı zamanı yaklaşıyor.",
  recipient: "905320000000",
  error: null,
  sentInstead,
});

/**
 * Which reminder's message went out in place of this one.
 *
 * Three answers, and the third is the one worth a test: a link when the
 * row it names is on this page, plain text when it is not, and NOTHING
 * when the read side could not say. `null` there means "cannot say" and
 * not "there wasn't one" -- when several reminders in the window compose
 * the same text, the query refuses to guess which was sent. Printing a
 * dash or an empty field would turn that refusal into an answer.
 */
describe("naming the message that went instead", () => {
  it("links to the row when that row is on the page", async () => {
    render(
      await ReminderMessageLog({
        messages: [suppressed({ id: "r-1", title: "Kuduz aşısı" })],
        presentIds: new Set(["r-1"]),
      }),
    );

    expect(screen.getByRole("link", { name: "Kuduz aşısı" })).toHaveAttribute(
      "href",
      "#reminder-r-1",
    );
  });

  // The anchor only exists while that reminder is in the current filter,
  // and a link that scrolls nowhere promises what it cannot keep -- the
  // rule the phone numbers on this screen already follow.
  it("names it as plain text when the row is filtered out", async () => {
    render(
      await ReminderMessageLog({
        messages: [suppressed({ id: "r-1", title: "Kuduz aşısı" })],
        presentIds: new Set(),
      }),
    );

    expect(screen.getByText(/Kuduz aşısı/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says nothing at all when the query could not say", async () => {
    render(await ReminderMessageLog({ messages: [suppressed(null)] }));

    expect(
      screen.queryByText(new RegExp(tr.reminder.log.sentInstead)),
    ).not.toBeInTheDocument();
  });
});
