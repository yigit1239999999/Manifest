import { test, expect, type Page } from "@playwright/test";

// The focus ring, measured rather than spelled.
//
// `app/theme-tokens.test.ts` asserts that the button's class string
// contains the outline utilities. That assertion was green throughout the
// `ring-offset-background` era and would have stayed green if the colour
// had never reached the element, because a string cannot see what the
// browser computed. This is the other half: one real browser, one real
// page, `getComputedStyle`.
//
// One trap, and it is the reason this file exists in the shape it does.
// `transition-colors` includes `outline-color` in Tailwind v4, so on
// focus the mark animates from `currentColor` to `--ring` over 150ms.
// Read straight after focus and every button in every theme reports its
// own text colour — on a primary button that is 1.09 against the card in
// dark and 1.00 in light. It looks exactly like a broken focus ring, it
// is reproducible, and it is a clock. A whole cycle went into chasing it.
//
// So every reading here waits the ramp out. Written as a single read
// this test would fail today for a reason that is not true, and — worse
// — could be "fixed" by asserting `currentColor`, which would leave a
// guard standing over the defect.
//
// It collects offenders rather than stopping at the first one. A sweep
// that halts on button one tells you about button one; this is meant to
// answer "which of them", and the first run of it found a control
// nobody had looked at.

const RING = { light: "rgb(15, 122, 110)", dark: "rgb(52, 192, 168)" };

/**
 * Longer than the 150ms `transition-colors` takes.
 *
 * A fixed wait rather than "read twice and compare": two fast reads
 * taken before the transition starts agree with each other, and what
 * they agree on is `currentColor`.
 */
const SETTLE_MS = 300;

async function signUp(page: Page, stamp: number) {
  await page.goto("/sign-up");
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
  await page.getByLabel(/your name|adın/i).fill("E2E Tester");
  await page.getByLabel(/^email$/i).fill(`e2e+${stamp}@pettrack.test`);
  await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
  await page
    .getByRole("button", { name: /create account|hesap oluştur/i })
    .click();
  await expect(page).toHaveURL("/");
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
  }, theme);
}

/**
 * The token, read from the page rather than repeated here.
 *
 * If `--ring` is retuned this follows it and the constants above become
 * the thing that fails, which is the right way round. A colour written
 * in two places that must agree is a defect waiting for someone to
 * change one of them.
 */
async function ringColour(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-ring)";
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  });
}

test.describe("Focus ring", () => {
  test("every button on a page carries --ring, in both themes", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    // Three routes, and no variant named anywhere in here. Naming
    // variants is how one gets measured and the others assumed, which is
    // the mistake this whole episode came out of; the scan takes
    // whatever buttons the page has. Between them the dashboard, the
    // list and the form carry the submit, the toolbar actions and the
    // disclosures.
    let measured = 0;
    const offenders: string[] = [];

    for (const route of ["/", "/clients", "/clients/new"]) {
      await page.goto(route);

      // Keyboard modality first, once per navigation. Chromium only
      // matches `:focus-visible` on a programmatically focused button
      // when the last input was a key, so without this the outline is
      // never drawn and the test would measure the unfocused value —
      // which is `currentColor`, the exact wrong answer this file is
      // about.
      await page.keyboard.press("Tab");

      // The whole page, not `main`. Scoped to `main` this found one
      // button on three routes: nearly every action in a list is a link,
      // and the buttons that are buttons live in the topbar. `:visible`
      // because a button inside a closed dialog cannot take focus, and
      // focusing it would measure an unfocused element — `currentColor`
      // again, arriving by a third road.
      const buttons = page.locator("button:not([disabled]):visible");
      const count = await buttons.count();

      for (const theme of ["light", "dark"] as const) {
        await setTheme(page, theme);
        const ring = await ringColour(page);
        expect(ring, `--ring resolves in ${theme}`).toBe(RING[theme]);

        for (let i = 0; i < count; i++) {
          const button = buttons.nth(i);
          const name =
            (await button.getAttribute("aria-label")) ??
            (await button.innerText());
          const where = `${route} ${theme} "${name.trim()}"`;
          await button.focus();

          const shown = await button.evaluate((el) => {
            const s = getComputedStyle(el);
            return {
              visible: el.matches(":focus-visible"),
              width: s.outlineWidth,
              style: s.outlineStyle,
            };
          });
          if (!shown.visible) {
            offenders.push(`${where}: does not match :focus-visible`);
            continue;
          }
          if (shown.style === "none" || shown.width === "0px") {
            offenders.push(`${where}: no outline drawn`);
            continue;
          }

          await page.waitForTimeout(SETTLE_MS);
          const settled = await button.evaluate((el) => {
            const s = getComputedStyle(el);
            return { colour: s.outlineColor, width: s.outlineWidth };
          });

          if (settled.colour !== ring) {
            offenders.push(`${where}: outline ${settled.colour}, want ${ring}`);
          }
          if (settled.width !== "2px") {
            offenders.push(`${where}: outline ${settled.width}, want 2px`);
          }
          // The offset is deliberately not asserted, and this is a
          // judgement rather than an omission. A standalone button takes
          // 2px so the mark sits on the surface behind it instead of on
          // its own fill; a segment inside a bordered group takes 0, or
          // the mark crosses its neighbour. One number for both would be
          // wrong somewhere, and the thing that has to be the same
          // everywhere is the colour, which is what this checks.
          //
          // The old `ring-offset-background` cannot come back unnoticed
          // even so: `app/theme-tokens.test.ts` fails on the string.
          measured++;
        }
      }
    }

    // The floor first, so that "nothing was wrong" cannot be reported by
    // a scan that found nothing. Three routes times two themes, so this
    // sits well under what the pages hold — it is here to catch the
    // selector going stale, not to count buttons.
    expect(measured).toBeGreaterThan(5);

    expect(offenders).toEqual([]);
  });
});
