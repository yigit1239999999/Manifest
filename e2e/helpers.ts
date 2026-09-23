import { test as base } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * Picks an entry in a Combobox field (components/ui/combobox.tsx): the
 * visible control is a text input with role "combobox" whose list opens on
 * focus, and choosing an option happens on mousedown.
 *
 * With `text`, it is typed first and the option whose name contains it is
 * picked; without, the first option is. The pickers this drives (owner,
 * client, pet) used to be plain <select>s, which is why the specs once
 * called `selectOption` here.
 */
export async function pickOption(page: Page, field: Locator, text?: string) {
  await field.click();
  if (text) await field.fill(text);
  const options = page.getByRole("option");
  const option = text
    ? options.filter({ hasText: new RegExp(escapeRegExp(text), "i") }).first()
    : options.first();
  await option.click();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The suite's `test`, with one thing added: a page that fell into an
 * error boundary fails the test that was on it.
 *
 * Why this exists, and why it is not an assertion somebody remembers to
 * write. Under two concurrent suites the dashboard threw, `app/(app)/
 * error.tsx` rendered -- and it renders as `{children}`, so it sits
 * INSIDE `<main>` where every locator still finds things. Thirty-five
 * tests went on passing on a screen that had crashed; the only one that
 * noticed was counting links, and it noticed by accident. Then
 * `Button` was given the `type="button"` it should always have had, the
 * accident stopped happening, and the suite went completely blind to a
 * crashed page.
 *
 * So the gate is a fixture rather than a line in one spec: a defect has
 * to be reported where it falls, and every test is standing somewhere it
 * could fall.
 *
 * Found by the error state's own words rather than a test id: the suite
 * reads the screen the way a reader does in 297 places and the product
 * carries no test ids. The words come from the message files, so a
 * rewording cannot leave this watching for a sentence nobody shows.
 *
 * Sampled rather than checked once at the end: a boundary the test
 * navigated away from is still a crash the vet would have seen, and the
 * teardown check alone would miss it.
 */
const ERROR_BOUNDARY_TEXTS = [
  trMessages.error.generic,
  enMessages.error.generic,
];

export const test = base.extend<{ noErrorBoundary: void }>({
  noErrorBoundary: [
    async ({ page }, use, testInfo) => {
      await page.addInitScript((texts: string[]) => {
        const w = window as unknown as { __errorBoundary?: string };
        const look = () => {
          const body = document.body?.innerText ?? "";
          const hit = texts.find((t) => body.includes(t));
          if (hit && !w.__errorBoundary) {
            // The digest, when the boundary printed one: it is the
            // reference a reader would quote to support, and the only
            // handle on WHICH throw this was.
            const ref = /ref:\s*\S+/.exec(body)?.[0] ?? "no digest";
            w.__errorBoundary = `${location.pathname} -- ${ref}`;
          }
        };
        setInterval(look, 250);
        document.addEventListener("DOMContentLoaded", look);
      }, ERROR_BOUNDARY_TEXTS);

      await use();

      // Read from whatever document the test finished on, and stay quiet
      // if the page is already gone: a closed context is the test's own
      // business, not a crash.
      let seen: string | undefined;
      try {
        seen = await page.evaluate(
          () => (window as unknown as { __errorBoundary?: string }).__errorBoundary,
        );
      } catch {
        seen = undefined;
      }
      if (seen) {
        throw new Error(
          `The page fell into an error boundary during this test (${seen}). ` +
            `Whatever else passed, it passed on a crashed screen. ` +
            `The server's log names the throw; see task #26.`,
        );
      }
      void testInfo;
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
