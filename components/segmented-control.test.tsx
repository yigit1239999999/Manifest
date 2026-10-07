// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

const setLocale = vi.fn();
vi.mock("@/lib/locale", () => ({ setLocale: (v: string) => setLocale(v) }));

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

// One model for a segmented single-choice control, and this file is
// where it is enforced rather than described.
//
// The two in this product had drifted into two models. `ThemeToggle`
// left all three segments enabled; `LocaleSwitcher` marked the current
// language by *disabling* it. That word means "this control cannot be
// used", and what was meant was "this one is already chosen" — a state.
// Saying it the wrong way cost three things at once: the current
// language could not be reached by keyboard at all, so a two-option
// group behaved like a one-button control; a screen reader heard
// "dimmed" and never heard "selected", and being unusable does not
// explain being current; and the accent fill was left as the only
// channel carrying which one is on.
//
// The rule:
//
//   `role="group"` with an `aria-label`, each segment a real button,
//   the chosen one carrying `aria-pressed="true"` and staying enabled
//   and focusable. Pressing the chosen one is a harmless no-op, which
//   is what makes leaving it enabled safe. `disabled` is for a segment
//   that genuinely cannot be used, never for one that is already
//   selected. A pending change marks the group `aria-busy`; it does not
//   disable the button under the user's finger.
//
// Its span is groups of two to five, where every segment is a tab stop.
// Larger pickers (`SpeciesPicker`, eleven options) use roving tabindex
// instead — what roving buys is a smaller tab-stop count, and three
// segments have no such cost to pay. Two spans of one rule, not two
// rules.

function renderIn(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );
}

/** Every segmented control in the product, by its group label. */
const CONTROLS = [
  { name: "the language switch", ui: <LocaleSwitcher />, label: tr.common.language },
  { name: "the theme switch", ui: <ThemeToggle />, label: tr.common.theme },
];

describe.each(CONTROLS)("$name", ({ ui, label }) => {
  it("lets a keyboard reach every segment, including the chosen one", () => {
    const { unmount } = renderIn(ui);
    const group = screen.getByRole("group", { name: label });
    const buttons = within(group).getAllByRole("button");

    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) {
      // Not `toBeEnabled()` alone: the point is reachability. A
      // disabled button is skipped by Tab, so a group whose current
      // option is disabled presents one fewer control than it has.
      expect(button).toBeEnabled();
      button.focus();
      expect(document.activeElement).toBe(button);
    }
    unmount();
  });

  it("says which one is chosen, in the accessibility tree", () => {
    const { unmount } = renderIn(ui);
    const group = screen.getByRole("group", { name: label });
    const buttons = within(group).getAllByRole("button");

    // Exactly one, and it is announced rather than only coloured.
    const pressed = buttons.filter(
      (b) => b.getAttribute("aria-pressed") === "true",
    );
    expect(pressed).toHaveLength(1);
    // And the rest say so explicitly; a missing attribute is not a "no".
    for (const button of buttons) {
      expect(button.getAttribute("aria-pressed")).toMatch(/^(true|false)$/);
    }
    unmount();
  });
});

describe("pressing the language already in use", () => {
  it("does nothing, and leaves the focus where it was", () => {
    setLocale.mockClear();
    renderIn(<LocaleSwitcher />);

    const group = screen.getByRole("group", { name: tr.common.language });
    const current = within(group).getByRole("button", { pressed: true });

    current.focus();
    fireEvent.click(current);

    // The no-op is what makes leaving the button enabled safe: it is
    // reachable, and reaching it costs nothing.
    expect(setLocale).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(current);
  });
});
