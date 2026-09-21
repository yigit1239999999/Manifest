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
      //
      // Ticks and radios are in the net because they were not, and ux
      // found the sixth group this missed: nine hand-written inputs
      // with no focus class, falling through to Chromium's own ring at
      // 2.89 against the dark card. A sweep is only as wide as its
      // selector, and the next hole will be in whatever this still
      // does not name.
      const buttons = page.locator(
        "button:not([disabled]):visible, " +
          "input[type=checkbox]:not([disabled]):visible, " +
          "input[type=radio]:not([disabled]):visible",
      );
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
          // judgement rather than an omission. There are two shapes and
          // the rule for choosing between them is:
          //
          //   A control standing on its own takes `outline-offset: 2px`,
          //   so the mark sits on the surface behind it rather than on
          //   its own fill.
          //
          //   Segments sitting side by side inside a bordered group take
          //   `outline-offset: 0`. An outset mark crosses the neighbour
          //   and the group's own border, and the gap was not carrying
          //   the contrast anyway: at offset 0 the line sits just
          //   outside the border box, which is the group's `bg-card`
          //   and not the selected segment's fill, and ux measured it
          //   there at 7.62 dark / 5.21 light. (My earlier 5.69 / 4.58
          //   was against `bg-accent` — the same verdict off the wrong
          //   surface, which is the mistake this file exists to stop.)
          //
          // The rule lives here rather than only in the two call sites
          // because the third segmented group is the one that will get
          // it wrong. What the test can check is the part that must be
          // identical everywhere, which is the colour.
          //
          // The old `ring-offset-background` cannot come back unnoticed
          // even so: `app/theme-tokens.test.ts` fails on the string.
          measured++;
        }
      }
    }

    // A segmented control presents as many controls as it has segments,
    // or it is lying about how many choices there are. `LocaleSwitcher`
    // marked the current language by disabling it, so a two-option
    // group offered the keyboard exactly one button and the current
    // language could not be reached at all. ux counted that by hand;
    // counting by hand is not done twice.
    for (const route of ["/", "/clients", "/clients/new"]) {
      await page.goto(route);
      const groups = page.locator("[role=group]:visible");
      for (let g = 0; g < (await groups.count()); g++) {
        const group = groups.nth(g);
        const name = await group.getAttribute("aria-label");
        const total = await group.locator("button:visible").count();
        if (total === 0) continue;
        // A second locator, not `.locator()` chained off the first:
        // chaining descends into the buttons' children rather than
        // narrowing the buttons, so it would have counted zero
        // everywhere and reported every group as broken.
        const reachable = await group
          .locator("button:visible:not([disabled])")
          .count();
        if (reachable !== total) {
          offenders.push(
            `${route} group "${name}": ${reachable} of ${total} segments reachable`,
          );
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
