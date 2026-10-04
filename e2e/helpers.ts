import { test as base, expect as baseExpect } from "@playwright/test";
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
 * Two limits, both real. It watches `page`, so a second tab or context
 * would be outside it -- no test opens one today, and widening the net
 * for a road nobody walks is its own kind of defect. And it fires when
 * the boundary MOUNTS.
 * A throw the server swallows, one a retry recovers, or one that never
 * reaches a boundary is invisible here. A net over the suite is not a
 * perfect net.
 */
// The same set as the `boundary=` call sites -- `app/error.tsx:16` and
// `app/(app)/error.tsx:17`. If a third boundary is added and its name is
// not added here, this guard goes quiet on that screen: the two lists
// are one list kept in two places, which is the shape of defect this
// file exists to catch.
export const BOUNDARY_NAMES = ["app.error", "app.section"];

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

/**
 * Refuses to submit a form that has lost what was typed into it.
 *
 * WHY THIS IS A LINE IN A HELPER AND NOT A NOTE SOMEBODY REMEMBERS. On 26
 * September 2026 four full runs reported, in five different tests, that "a
 * server action does not complete in 20 seconds" -- and it was wrong. The
 * artefact of the one red that survived a fresh server said something else
 * entirely:
 *
 *     - textbox "Clinic name"                 <- EMPTY
 *     - textbox "Your name": E2E Tester       <- filled
 *     - textbox "Email": e2e+...              <- filled
 *     - textbox "Password": supersecret123    <- filled
 *     - alert                                 <- EMPTY
 *
 * The first field had lost its value, every input on that form carries
 * `required`, so the browser's own validation refused the submit: the click
 * produced NO request, the URL was never going to change, and the test
 * spent twenty seconds watching it not change. The reported symptom named
 * the wrong half of the system, and two people repeated it for four runs.
 *
 * So the check goes where the click is: before submitting, no required
 * input may be empty. It costs milliseconds, it fails in about one second
 * instead of twenty, and it fails saying WHICH field emptied.
 *
 * WHAT IT DOES NOT DO, because the difference matters: it does not explain
 * WHY a value went missing. Whether hydration wipes what was typed before
 * the page is interactive, or the fill lands before React attaches, is not
 * measured -- twelve rounds against a warm, idle server never lost a value.
 * This is the instrument that will collect that evidence, not the cure.
 * If a real vet can lose a typed clinic name this way they see nothing at
 * all, because what stops them is the browser's own bubble.
 */
export async function assertFormKept(page: Page) {
  const empty = await page
    .locator("form input[required]")
    .evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLInputElement).value === "")
        .map((el) => (el as HTMLInputElement).name || "(adsız)"),
    );
  baseExpect(
    empty,
    "the form lost what was typed into it before it could be submitted -- " +
      "the browser will refuse this submit and nothing will be requested",
  ).toEqual([]);
}

export { expect } from "@playwright/test";

/**
 * Saves the open vaccination form. A vaccine the clinic has a schedule
 * for asks once when its next date is empty (use the suggestion, or save
 * empty), so a spec that means "empty" says so by answering.
 */
export async function saveVaccination(page: Page, form: Locator) {
  await form.getByRole("button", { name: /save vaccination|aşıyı kaydet/i }).click();
  const saveEmpty = form.getByRole("button", {
    name: /save without a date|boş kaydet/i,
  });
  // Either the question appears or the save goes through; wait for one.
  await Promise.race([
    saveEmpty.waitFor({ state: "visible", timeout: 5_000 }).then(() => saveEmpty.click()),
    form.page().waitForTimeout(5_000),
  ]).catch(() => {});
}
