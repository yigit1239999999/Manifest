import { test, expect, type Page } from "@playwright/test";

// How big the thing you tap actually is.
//
// A tick or a radio is 16px square, which is under any target size
// anyone has ever asked for. What saves it is the `<label>` around it:
// the label is clickable too, so the real target is as wide as the
// words. That is true and it is only half the measurement — pm found
// the consent radios at 81×20 and 101×20 in Turkish, 111×20 and 80×20
// in English. Width was never the problem. Height was the line box,
// 20px, against the 24 that WCAG 2.5.8 asks for, on the two controls a
// phone user taps to answer a question about consent.
//
// ux had measured the focus mark on these same controls and wrote down
// that they had not looked at target size. pm looked. This is so that
// the next person does not have to.
//
// Only labels that wrap a control: a label sitting beside a text input
// is not a target, and counting it would turn this into noise.
//
// WHAT IT RUNS AGAINST, which decides what it can find.
//
// It used to sign up a fresh clinic, so it measured an empty one — and
// every sideways-scroll defect found by hand today was data-dependent
// and invisible without records:
//
//   /staff             413px   long emails and names
//   species chip        76px   a built-in species switched off
//   dashboard          140px   a chart with bars to draw
//
// None of those exist in a clinic five minutes old. pm swept 17 routes
// against an empty one on the same build, minutes from the run that
// found the dashboard, and reported every route clean; both runs were
// right about what they measured. A guard in that position does worse
// than nothing, because green stops anyone looking by hand.
//
// So it signs in to the state clinic, which exists for this. And
// because a clean result is only worth what the run exercised, every
// route states what must be true before it is measured — the chart has
// to have drawn, the long email has to be on the page, the suggestion
// chip has to be on screen. If the data is not there the run fails
// saying so, rather than passing quietly.
//
// pm's rule, which this is: a zero can mean the defect is absent or
// that you could not produce it, and those are not the same result.

const MIN = 24;

/** The clinic the odd states live in. Printed by `scripts/seed-states.mjs`. */
const STATE_CLINIC = {
  email: "hal@ornek-veteriner-klinigi.example",
  password: "hal-klinigi-seed",
};

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel(/^email$/i).fill(STATE_CLINIC.email);
  await page.getByLabel(/^password|^şifre/i).fill(STATE_CLINIC.password);
  await page
    .getByRole("button", { name: /sign in|giriş yap/i })
    .click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
    timeout: 30_000,
  });
}

test.describe("Tap targets", () => {
  test("nothing is too small to tap, and nothing hangs off the side", async ({
    page,
  }) => {
    await signIn(page);

    const offenders: string[] = [];
    let measured = 0;

    // Per route, and with a floor each, because a single global floor
    // hid a real failure. `/settings` reported 23 targets on one run
    // and 0 on the next; the run that saw none passed, because the two
    // on `/clients/new` satisfied the total on their own. A scan that
    // can silently measure nothing is worth less than no scan, since
    // it reports the same green either way.
    //
    // `/pets/new` is 0 on purpose: its only tick sits behind a
    // disclosure and is not laid out until it is opened. Written as a
    // number rather than left out, so the day it grows one this says
    // the expectation moved.
    const ROUTES: {
      path: string;
      least: number;
      /**
       * What must be true before this route is worth measuring.
       *
       * Returns the thing it verified so the failure says which
       * precondition was not met, rather than the route looking
       * clean because the defective path never ran.
       */
      ready?: (page: Page) => Promise<void>;
    }[] = [
      { path: "/clients/new", least: 2 },
      {
        path: "/pets/new",
        least: 0,
        // The suggestion chip is the thing that overflowed, and it
        // only exists once something is typed that names a built-in
        // the clinic has switched off. The state clinic has RABBIT
        // off; if that changes, this fails here rather than passing
        // with nothing on screen.
        ready: async (p) => {
          await p.getByRole("button", { name: /yeni tür|new species/i }).click();
          // By its placeholder, because there are three text boxes on
          // this page with none and my first attempt filled the breed
          // field instead — then reported the chip missing, which was
          // true and about the wrong control. Two of us failed to
          // produce this chip today and neither failure was the
          // product's.
          await p
            .locator(
              'input[placeholder^="Species name"], input[placeholder^="Tür adı"]',
            )
            .fill("Tavşan");
          // Typed in Turkish against an English interface on purpose:
          // the fold is the reason this feature exists, so the
          // precondition exercises it rather than taking the easy
          // spelling.
          await expect(
            p.getByRole("button", { name: /Rabbit|Tavşan/ }),
            "the species suggestion chip — RABBIT may no longer be switched off in the state clinic",
          ).toBeVisible();
        },
      },
      {
        path: "/",
        least: 0,
        // The dashboard only overflows once a chart has bars. An
        // empty clinic draws none, which is how a 17-route sweep
        // called this route clean on the build it was broken on.
        ready: async (p) => {
          await expect(
            p.locator('[role="img"]').first(),
            "a drawn chart — the dashboard cannot overflow without one",
          ).toBeVisible();
        },
      },
      {
        path: "/staff",
        least: 0,
        // 413px, and it came from the length of an address.
        ready: async (p) => {
          await expect(
            // `.first()`: the address appears twice below `lg` — in
            // the row's stand-in line and in the column that replaces
            // it — which is the pairing `app/list-fallbacks.test.ts`
            // exists to keep. Either is proof the data is there.
            p.getByText(/cok\.uzun\.bir\.eposta/).first(),
            "the long address row — /staff overflowed on text, not layout",
          ).toBeVisible();
        },
      },
      { path: "/settings", least: 4 },
    ];

    for (const { path: route, least, ready } of ROUTES) {
      await page.goto(route);
      // The reason for the flake: `goto` resolves before the client
      // components have laid out, so the scan sometimes ran against a
      // page that had not finished arriving.
      await page.waitForLoadState("networkidle");
      // The phone is where this matters and where pm measured it.
      await page.setViewportSize({ width: 390, height: 844 });
      // After the resize, so anything it opens is laid out at the
      // width being measured.
      if (ready) await ready(page);

      const found = await page.evaluate((min) => {
        const out: { where: string; w: number; h: number }[] = [];
        for (const label of document.querySelectorAll("label")) {
          const control = label.querySelector(
            'input[type="checkbox"], input[type="radio"]',
          );
          if (!control) continue;
          const box = label.getBoundingClientRect();
          if (box.width === 0 && box.height === 0) continue; // not shown
          out.push({
            where: (label.textContent ?? "").trim().slice(0, 30),
            w: Math.round(box.width),
            h: Math.round(box.height),
          });
        }
        return out.filter(() => true).map((r) => ({ ...r, under: r.h < min }));
      }, MIN);

      // Nothing should reach past the right edge of a phone. ux found
      // two of these by hand today — /staff at 413px and the species
      // suggestion chip at 76px — and neither sweep asked, because
      // one measures target size and the other measures focus marks.
      // The most visible defect on a narrow screen had no guard at
      // all.
      const sideways = await page.evaluate(() => {
        const measured =
          document.documentElement.scrollWidth - window.innerWidth;
        // `scrollWidth` alone is not enough, and pm caught it: once
        // this turn it read exactly `innerWidth` and the page still
        // scrolled. So ask the page to move and see whether it does.
        window.scrollTo(900, 0);
        const moved = window.scrollX;
        window.scrollTo(0, 0);
        return { measured, moved };
      });
      if (sideways.measured > 0 || sideways.moved > 0) {
        offenders.push(
          `${route}: page scrolls sideways (scrollWidth +${sideways.measured}px, scrollX ${sideways.moved})`,
        );
      }

      expect(
        found.length,
        `${route} reported no targets — the scan saw a page that was not there`,
      ).toBeGreaterThanOrEqual(least);

      for (const row of found) {
        measured++;
        if (row.under) {
          offenders.push(`${route} "${row.where}": ${row.w}x${row.h}`);
        }
      }
    }

    // The totals are held per route above; this only catches the
    // selector disappearing entirely.
    expect(measured).toBeGreaterThan(1);
    expect(offenders).toEqual([]);
  });
});
