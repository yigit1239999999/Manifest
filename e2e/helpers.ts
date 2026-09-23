import { test as base } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

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
 * error boundary fails the test that was standing on it.
 *
 * Why this exists, and why it is not a line somebody remembers to write.
 * Under two concurrent suites the dashboard threw and `app/(app)/
 * error.tsx` rendered -- and it renders as `{children}`, so it sits
 * INSIDE `<main>` where every locator still finds things. Thirty-five
 * tests went on passing on a screen that had crashed. One noticed, by
 * accident: it counted the links in `main`, and the error state happens
 * to carry two. Then `Button` was given the `type="button"` it should
 * always have had, the crashed page started offering one, and the
 * accident stopped. The suite went blind, and the way it had seen was
 * never a decision in the first place.
 *
 * The signal is the boundary's own `console.error(boundary, …)`
 * (`components/error-state.tsx:33`), not the words on the screen and not
 * a test id.
 *
 * - Not the words: they live in the message files and get reworded, and
 *   a reworded sentence would leave this watching for something nobody
 *   shows -- the guard itself going quiet, which is the defect this task
 *   is about. `error.generic` can also legitimately appear elsewhere,
 *   so a text scan can shout at an intact screen.
 * - Not the DOM: `Button`'s default emptied the counting guard's set
 *   precisely because its input was markup. A guard whose input is not
 *   markup cannot be silenced that way.
 *
 * Its limit, and it is a real one: this fires when the boundary MOUNTS.
 * A throw the server swallows, one a retry recovers, or one that never
 * reaches a boundary is invisible here. A net over the suite is not a
 * perfect net.
 */
// The same set as the `boundary=` call sites -- `app/error.tsx:16` and
// `app/(app)/error.tsx:17`. If a third boundary is added and its name is
// not added here, this guard goes quiet on that screen: the two lists
// are one list kept in two places, which is the shape of defect this
// file exists to catch.
const BOUNDARY_NAMES = ["app.error", "app.section"];

export const test = base.extend<{ noErrorBoundary: void }>({
  noErrorBoundary: [
    async ({ page }, use) => {
      // Registered before the test navigates anywhere: a boundary that
      // mounts on the first page is the one most worth catching.
      const seen: Promise<string>[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const name = BOUNDARY_NAMES.find((b) => msg.text().startsWith(b));
        if (!name) return;
        const where = page.url();
        // The digest is the second argument, and it is the only handle
        // on WHICH throw this was -- the reference a reader would quote
        // to support. Resolved rather than read off `text()`, which
        // prints the object as `JSHandle@object`.
        seen.push(
          msg
            .args()[1]
            ?.jsonValue()
            .then((v: unknown) => {
              const d = (v as { digest?: string } | undefined)?.digest;
              const m = (v as { message?: string } | undefined)?.message;
              return `${name} at ${where} -- ${d ? `ref: ${d}` : "no digest"}${m ? ` -- ${m}` : ""}`;
            })
            .catch(() => `${name} at ${where}`) ?? Promise.resolve(`${name} at ${where}`),
        );
      });

      await use();

      if (seen.length > 0) {
        const lines = await Promise.all(seen);
        throw new Error(
          `The page fell into an error boundary during this test:\n  ` +
            lines.join("\n  ") +
            `\nWhatever else passed, it passed on a crashed screen. The ` +
            `server's log names the throw; see task #26.`,
        );
      }
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
