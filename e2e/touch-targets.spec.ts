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

const MIN = 24;

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

test.describe("Tap targets", () => {
  test("a label wrapping a tick or radio is at least 24px tall", async ({
    page,
  }) => {
    await signUp(page, Date.now());

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
    const ROUTES = [
      { path: "/clients/new", least: 2 },
      { path: "/pets/new", least: 0 },
      { path: "/settings", least: 4 },
    ];

    for (const { path: route, least } of ROUTES) {
      await page.goto(route);
      // The reason for the flake: `goto` resolves before the client
      // components have laid out, so the scan sometimes ran against a
      // page that had not finished arriving.
      await page.waitForLoadState("networkidle");
      // The phone is where this matters and where pm measured it.
      await page.setViewportSize({ width: 390, height: 844 });

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
