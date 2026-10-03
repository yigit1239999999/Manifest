// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";
import en from "@/messages/en.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { CommandPalette } from "@/components/command-palette";

/**
 * What the box on the topbar is called, and who hears the same name.
 *
 * The naming was decided after looking at the screen rather than at this
 * file (ux, #12): the palette does not only search. Below two typed
 * letters it draws an "Ekle" group of five creation actions, so a box
 * called "Ara…" promises less than it does -- and the decision it is part
 * of, "shall I open this", is taken before it opens, which puts the second
 * verb on the trigger rather than inside it.
 *
 * Two spellings were rejected and this file holds the second rejection as
 * a rule rather than as a note: giving the visible text one string and the
 * accessible name another would make this the first control in the product
 * where the two disagree. So they are asserted to be the same string, and
 * in both catalogues, because a name that drifts in one language is the
 * way half of a two-language product dies quietly.
 */
function mount(messages: typeof tr, locale: string) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CommandPalette />
    </NextIntlClientProvider>,
  );
}

describe("the command palette's name", () => {
  it.each([
    ["tr", tr],
    ["en", en],
  ])("says the same thing to the eye and to a screen reader (%s)", (locale, messages) => {
    mount(messages as typeof tr, locale);

    const trigger = screen.getByRole("button", { name: messages.common.search });
    // The accessible name and the visible text are one string, not two that
    // happen to agree today.
    expect(trigger.getAttribute("aria-label")).toBe(messages.common.search);
    expect(trigger.textContent).toContain(messages.common.search);
  });

  it("names the second thing it does, because it does it before two letters are typed", () => {
    // Not a spelling check: the point is that the name carries a second
    // verb at all. `command-palette.tsx` draws the creation group while the
    // query is under two characters, and a name with one verb in it
    // describes half of that. If the creation group is ever removed, this
    // is the line that should be removed with it.
    expect(tr.common.search).toMatch(/ekle/i);
    expect(en.common.search).toMatch(/add/i);
    // The shape is the product's own, not a new one: eight comboboxes
    // already carry `searchOrType` ("Ara veya yaz…"), so a two-verb
    // placeholder is the existing vocabulary rather than an invention.
    expect(tr.common.searchOrType).toMatch(/veya/i);
  });
});
