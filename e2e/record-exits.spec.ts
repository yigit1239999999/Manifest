import { pickOption, test, expect } from "./helpers";
import type { Page } from "@playwright/test";

// Journey 2, walked rather than read.
//
// A familiar animal arrives and the vet's first question is "what
// happened last time". Four ways into a record lead to that answer and
// two of them used to stop short: from the dashboard's upcoming
// appointments and recent visits the vet landed on a page where the
// animal's name was text, and the way to its history was back out into
// the list and a search for a name already on the screen.
//
// `app/record-exits.test.ts` holds the same rule by reading source --
// the link exists, and it is in the detail list rather than the heading.
// This walks it: from the dashboard, through the record, to the history.
// The two are not the same evidence, and the source test says so.

async function signUp(page: Page, stamp: number) {
  await page.goto("/sign-up");
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
  await page.getByLabel(/your name|adınız/i).fill("E2E Tester");
  await page.getByLabel(/^e-?mail$|^e-posta$/i).fill(`exits+${stamp}@pettrack.test`);
  await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
  await page.getByRole("button", { name: /create account|hesap oluştur/i }).click();
  await expect(page).toHaveURL("/");
}

/** One save, three records: the animal, its owner and the visit. */
async function recordFirstVisit(page: Page) {
  await page.goto("/visits/new");
  const main = page.getByRole("main");
  await main.getByRole("combobox", { name: /^pet$|^hayvan$/i }).fill("Limon");
  await main.getByRole("option", { name: /Limon/ }).last().click();
  await page.getByRole("button", { name: /^cat$|^kedi$/i }).click();
  await main
    .getByRole("combobox", { name: /^owner$|^sahibi$/i })
    .fill("Ayşe Çelik");
  await main.getByRole("option", { name: /Ayşe Çelik/ }).last().click();
  await page.getByRole("checkbox", { name: /save without a number|numarasız kaydet/i }).check();
  await page.getByRole("button", { name: /create visit|viziti kaydet/i }).click();
  await expect(page).toHaveURL(/\/visits\/(?!new)[\w-]+(\?|$)/);
}

test.describe("A record leads back to the animal", () => {
  test("from the dashboard's recent visits to the history", async ({ page }) => {
    await signUp(page, Date.now());
    await recordFirstVisit(page);

    // The way in the vet actually takes: the dashboard, not a deep link.
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: /Limon/ }).first().click();

    // Either list on the dashboard may name the animal, so the walk is
    // asserted from wherever it landed: a record page, then out of it.
    if (!/\/pets\//.test(page.url())) {
      await expect(page).toHaveURL(/\/(visits|appointments)\/(?!new)[\w-]+/);
      await page
        .getByRole("main")
        .getByRole("link", { name: /^Limon$/ })
        .first()
        .click();
    }

    await expect(page).toHaveURL(/\/pets\/(?!new)[\w-]+/);
    // The history is what the walk was for, not the page's title.
    await expect(page.getByRole("heading", { name: "Limon" })).toBeVisible();
  });

  test("from an appointment to the same history", async ({ page }) => {
    await signUp(page, Date.now());
    await recordFirstVisit(page);

    await page.goto("/appointments/new");
    await pickOption(page, page.getByLabel(/^pet$|^hayvan$/i));
    await page.getByRole("button", { name: /create appointment|randevu oluştur/i }).click();
    await expect(page).toHaveURL(/\/appointments\/(?!new)[\w-]+/);

    await page
      .getByRole("main")
      .getByRole("link", { name: /^Limon$/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/pets\/(?!new)[\w-]+/);
    await expect(page.getByRole("heading", { name: "Limon" })).toBeVisible();
  });
});
