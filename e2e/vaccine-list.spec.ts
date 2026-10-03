import { pickOption, test, expect, assertFormKept } from "./helpers";
import type { Page } from "@playwright/test";

/**
 * The vaccine list, walked (#37).
 *
 * The vet's problem this exists for: "Karma üç doz, sahibi ikinci dozdan
 * sonra kayboluyor... emin olamayınca baştan başlatıyorum, sahibi de
 * boşuna para veriyor." So the two things that have to be true on screen
 * are that the product PROPOSES an interval and says WHOSE it is, and
 * that it refuses to propose one where the answer is genuinely disputed.
 *
 * Unit tests already read the form's own FormData; what they cannot see
 * is whether a real browser, a real clinic and a real record agree. The
 * settings leg puts the fixture clinic back the way it found it, because
 * a spec that leaves its clinic changed is a spec that only passes first.
 */

async function signUp(page: Page, stamp: number) {
  await page.goto("/sign-up");
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
  await page.getByLabel(/your name|adınız/i).fill("E2E Tester");
  await page.getByLabel(/^e-?mail$|^e-posta$/i).fill(`vax+${stamp}@pettrack.test`);
  await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
  await assertFormKept(page);
  await page.getByRole("button", { name: /create account|hesap oluştur/i }).click();
  await expect(page).toHaveURL("/");
}

async function createDog(page: Page) {
  await page.goto("/clients/new");
  await page.getByLabel(/first name|^ad$/i).fill("Deniz");
  await page.getByLabel(/last name|soyad/i).fill("Yıldız");
  await page.getByLabel(/^phone$|^telefon$/i).fill("0532 222 33 44");
  await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
  await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);

  await page.goto("/pets/new");
  await pickOption(page, page.getByLabel(/^owner$|^sahibi$/i));
  await page.getByLabel(/^name$|^[İi]sim$/i).fill("Paşa");
  await page.getByRole("button", { name: /^dog$|^köpek$/i }).click();
  await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();
  await expect(page).toHaveURL(/\/pets\/(?!new)[\w-]+$/);
  return page.url();
}

function vaccinationForm(page: Page) {
  return page.locator("details", { hasText: /add vaccination|aşı ekle/i });
}

test.describe("The vaccine list the product ships with", () => {
  test("proposes an interval, says whose it is, and writes the dose", async ({ page }) => {
    await signUp(page, Date.now());
    await createDog(page);

    const vacc = vaccinationForm(page);
    await vacc.locator("summary").click();
    // Nothing else is touched: the administration date is already today,
    // and agreeing with it by leaving it alone has to be enough.
    await vacc.getByLabel(/^vaccine$|^aşı$/i).fill("Karma");

    // Whose number it is, in a sentence, before anything is written.
    await expect(
      page.getByText(/from the list|listeden geldi/i),
    ).toBeVisible();
    // Three doses, and which one this animal is on.
    await expect(page.getByText(/starting series of|dozluk başlangıç serisi/i)).toBeVisible();

    await page.getByRole("button", { name: /later ·|sonra ·/i }).click();
    await vacc.getByRole("button", { name: /save vaccination|aşıyı kaydet/i }).click();
    await expect(page.getByText("Karma").first()).toBeVisible();
  });

  test("refuses to date the vaccine nobody agrees on", async ({ page }) => {
    await signUp(page, Date.now() + 1);
    await createDog(page);

    const vacc = vaccinationForm(page);
    await vacc.locator("summary").click();
    await vacc.getByLabel(/^vaccine$|^aşı$/i).fill("Köpek öksürüğü");

    // The question, in words, rather than an empty field that looks like
    // an oversight -- and no chip to tap.
    await expect(
      page.getByText(/no repeat date is proposed|tekrar tarihi önerilmiyor/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /later ·|sonra ·/i })).toHaveCount(0);
  });

  test("the clinic can take a vaccine off its own list, and put it back", async ({ page }) => {
    await signUp(page, Date.now() + 2);
    const petUrl = await createDog(page);

    await page.goto("/settings");
    const card = page.locator("form", { hasText: /save vaccine list|aşı listesini kaydedin/i });
    const lepto = card.locator("li", { hasText: /Leptospiroz/ });
    await lepto.getByRole("checkbox").uncheck();
    await card.getByRole("button", { name: /save vaccine list|aşı listesini kaydedin/i }).click();
    await expect(page.getByText(/vaccine list saved|aşı listesi kaydedildi/i)).toBeVisible();

    // Off the list means not offered. The name is still typable, which is
    // why this asserts on the option and not on the field.
    await page.goto(petUrl);
    const vacc = vaccinationForm(page);
    await vacc.locator("summary").click();
    await vacc.getByLabel(/^vaccine$|^aşı$/i).click();
    await expect(page.getByRole("option", { name: /Leptospiroz/ })).toHaveCount(0);
    await expect(page.getByRole("option", { name: /^Kuduz/ })).toBeVisible();

    // And back, so the clinic is left as it was found.
    await page.goto("/settings");
    await lepto.getByRole("checkbox").check();
    await card.getByRole("button", { name: /save vaccine list|aşı listesini kaydedin/i }).click();
    await expect(page.getByText(/vaccine list saved|aşı listesi kaydedildi/i)).toBeVisible();

    await page.goto(petUrl);
    await vaccinationForm(page).locator("summary").click();
    await vaccinationForm(page).getByLabel(/^vaccine$|^aşı$/i).click();
    await expect(page.getByRole("option", { name: /Leptospiroz/ })).toBeVisible();
  });
});
