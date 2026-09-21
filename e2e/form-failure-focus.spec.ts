import { test, expect, type Page } from "@playwright/test";

// Where the cursor is after a submit the server refused.
//
// ux measured the answer and it was `body`. `SubmitButton` disabled
// itself on press; a control disabled under the user's finger loses
// focus, and focus does not come back when it is re-enabled. The
// disabling lasted under 150ms and the loss was permanent. From `body`
// to the first field that needed fixing: 22 Tab presses — the skip
// link, the logo, ten sidebar links, search, three theme segments, two
// language buttons, sign out. A vet fixing a typo walked the whole
// navigation skeleton of the product to reach it.
//
// Nothing was announced either, so for a screen reader the submit
// failed in silence.
//
// ux counted those 22 by hand and asked for a guard, because a
// countable thing is not counted by hand twice.

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

test.describe("A submit the server refused", () => {
  test("leaves the cursor somewhere the user can work from", async ({
    page,
  }) => {
    await signUp(page, Date.now());
    await page.goto("/clients/new");

    // The browser would block an empty submit before the server ever
    // saw it. Turning `novalidate` on is how ux produced the failure
    // and it writes nothing: the server rejects the body.
    //
    // `main form`, not `form`. The first form on the page is the sign
    // out button in the header, so the obvious selector set the flag
    // on the wrong one, the browser went on blocking the real submit,
    // and the test failed reporting "no error box" — which was true,
    // and about nothing.
    await page.evaluate(() => {
      document.querySelector("main form")?.setAttribute("novalidate", "");
    });

    const submit = page.getByRole("button", {
      name: /create client|müşteri oluştur/i,
    });
    await submit.focus();
    await page.keyboard.press("Enter");

    // The box appears when the response lands.
    const box = page.locator("[data-form-error]");
    await expect(box).toBeVisible();

    // The assertion ux asked for, in the form they asked for it:
    // not `body`.
    const landed = await page.evaluate(() => ({
      tag: document.activeElement?.tagName ?? "",
      inBox: Boolean(document.activeElement?.closest("[data-form-error]")),
    }));
    expect(
      landed.tag,
      "focus after a refused submit — `body` means it was dropped",
    ).not.toBe("BODY");
    expect(landed.inBox).toBe(true);

    // And the way back is one Tab, not twenty-two: the first thing
    // after the box is a line pointing at a field.
    await page.keyboard.press("Tab");
    const next = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label") ?? "",
    );
    expect(next, "the first stop after the box").toMatch(
      /alanına git|^Go to /,
    );
  });

  test("does not take the button away while it is working", async ({
    page,
  }) => {
    // The trigger for all of the above. `aria-busy` says "working"
    // without removing the control, so nothing loses focus.
    await signUp(page, Date.now() + 1);
    await page.goto("/clients/new");

    const submit = page.getByRole("button", {
      name: /create client|müşteri oluştur/i,
    });
    await expect(submit).toBeEnabled();
    await expect(submit).not.toHaveAttribute("aria-busy", "true");
  });
});
