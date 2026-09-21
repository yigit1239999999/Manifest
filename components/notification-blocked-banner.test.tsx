// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";
import { NETGSM_ERRORS } from "@/lib/messaging/sms/netgsm";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: never) =>
    createTranslator({ locale: "tr", messages: tr, namespace }),
}));

import { NotificationBlockedBanner } from "@/components/notification-blocked-banner";

/**
 * The banner exists so a clinic-wide problem is stated once instead of on
 * every row. Its link is the only part that depends on who is looking.
 */
describe("the clinic-wide notice", () => {
  it("offers the settings link to a role that can follow it", async () => {
    render(
      await NotificationBlockedBanner({
        children: "Otomatik mesajlar kapalı.",
        settingsHref: "/settings",
      }),
    );
    expect(
      screen.getByRole("link", { name: tr.reminder.delivery.openSettings }),
    ).toHaveAttribute("href", "/settings");
  });

  // Being unable to act on a fact is not a reason to be kept from it: the
  // notice stays and names who to ask. It says where to go without
  // claiming who the settings page belongs to (TEAM.md #30e).
  it("keeps the notice, and says who to ask, without the link", async () => {
    render(
      await NotificationBlockedBanner({ children: "Otomatik mesajlar kapalı." }),
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/Otomatik mesajlar kapalı/)).toBeInTheDocument();
    expect(screen.getByText(/yöneticinizle/)).toBeInTheDocument();
  });
});

/**
 * Every clinic-scope failure code has a sentence, in both languages.
 *
 * Without this, adding a code to `NETGSM_ERRORS` with `scope: "CLINIC"` and
 * forgetting the translation prints the raw key — "sender_title_not_
 * registered" — into the one banner a vet is supposed to act on. Nothing
 * else would catch it: the types are satisfied, the page renders, and the
 * code path only runs when a real provider rejects a real message.
 *
 * WHAT THIS DOES NOT CHECK (TEAM.md #30c): only Netgsm's table and the
 * one non-provider code below. A second SMS transport, or WhatsApp
 * rejections, would bring their own codes and are not covered here.
 * `MESSAGE`-scope codes are also skipped on purpose — no screen shows
 * their reason today, the row writes its own sentence instead.
 */
describe("clinic-scope failures are all sayable", () => {
  const clinicKeys = [
    ...Object.values(NETGSM_ERRORS)
      .filter((e) => e.scope === "CLINIC")
      .map((e) => e.key),
    "sms_not_configured",
  ];

  it.each([
    ["tr", tr],
    ["en", en],
  ] as const)("has a %s sentence for each one", (_locale, messages) => {
    const missing = clinicKeys.filter(
      (k) => !(k in (messages.enum.messageFailure as Record<string, string>)),
    );
    expect(missing).toEqual([]);
  });
});
