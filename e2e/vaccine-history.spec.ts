import { pickOption, test, expect } from "./helpers";
import type { Page } from "@playwright/test";

/**
 * The two questions the vet said history is actually for (#45).
 *
 * "O an sorduğum şey 'en son ne zaman' değil, KAÇINCI DOZDAYDIK... emin
 * olamayınca baştan başlatıyorum, sahibi de boşuna para veriyor." And,
 * after a bite: "ondan önce de düzenli miydi" -- which they pointed out
 * is not their question any more.
 *
 * Both are read off the animal's page, so both are walked there. The
 * doses are written through the real form, because the position the
 * screen reads back is the position the form wrote -- and that round
 * trip is the whole feature.
 */

async function signUp(page: Page, stamp: number) {
  await page.goto("/sign-up");
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
  await page.getByLabel(/your name|adınız/i).fill("E2E Tester");
  await page.getByLabel(/^e-?mail$|^e-posta$/i).fill(`hist+${stamp}@pettrack.test`);
  await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
  await page.getByRole("button", { name: /create account|hesap oluştur/i }).click();
  await expect(page).toHaveURL("/");
}

async function createDog(page: Page) {
  await page.goto("/clients/new");
  await page.getByLabel(/first name|^ad$/i).fill("Ece");
  await page.getByLabel(/last name|soyad/i).fill("Kaya");
  await page.getByLabel(/^phone$|^telefon$/i).fill("0532 444 55 66");
  await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
  await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);

  await page.goto("/pets/new");
  await pickOption(page, page.getByLabel(/^owner$|^sahibi$/i));
  await page.getByLabel(/^name$|^[İi]sim$/i).fill("Zeytin");
  await page.getByRole("button", { name: /^dog$|^köpek$/i }).click();
  await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();
  await expect(page).toHaveURL(/\/pets\/(?!new)[\w-]+$/);
  return page.url();
}

/** One dose through the real form, with the two answers a vet gives. */
async function recordDose(
  page: Page,
  vaccine: string,
  administered: string,
  options: { dose?: string; nextDue?: string } = {},
) {
  const form = page.locator("details", { hasText: /add vaccination|aşı ekle/i });
  await form.locator("summary").click();
  await form.getByLabel(/^vaccine$|^aşı$/i).fill(vaccine);
  await form.getByLabel(/administered|uygulanma tarihi/i).fill(administered);
  if (options.dose) {
    await form.getByLabel(/which dose|kaçıncı doz/i).fill(options.dose);
  }
  if (options.nextDue) {
    await form.getByLabel(/next due|sonraki tarih/i).fill(options.nextDue);
  }
  await form.getByRole("button", { name: /save vaccination|aşıyı kaydet/i }).click();
  await expect(page.getByText(/saved|kaydedildi/i).first()).toBeVisible();
}

test.describe("What the animal's own record says", () => {
  test("says which dose we were on, and that the next one is late", async ({ page }) => {
    await signUp(page, Date.now());
    await createDog(page);

    // The vet's scenario: two doses of three are in, and the third was
    // due while the owner was away. The next date is typed by hand and
    // is in the past, which is exactly how the vet would have left it.
    await recordDose(page, "Karma", "2026-06-01", { dose: "1" });
    await recordDose(page, "Karma", "2026-06-25", { dose: "2", nextDue: "2026-07-20" });

    await page.reload();
    await expect(page.getByText(/Karma series: 2\/3|Karma serisi: 2\/3/)).toBeVisible();
    await expect(page.getByText(/next dose overdue|sonraki doz gecikmiş/i)).toBeVisible();

    // The screen must not tell the vet to start the series again (#20),
    // but a locator for a sentence the product has never contained would
    // pass whatever the product said -- it is not an assertion, it is a
    // shape. What holds that rule is `messages/*.json` having no such
    // string, and the catalogue test that reads what this block renders.
  });

  test("shows the year somebody outside the clinic will ask about as missing", async ({
    page,
  }) => {
    await signUp(page, Date.now() + 1);
    await createDog(page);

    await recordDose(page, "Kuduz", "2024-05-10");
    await recordDose(page, "Kuduz", "2026-05-10");

    await page.reload();
    // 2025 is the hole, and it has to read as a hole rather than as a
    // row that is not there.
    await expect(page.getByText(/2024 given|2024 yapıldı/i)).toBeVisible();
    await expect(page.getByText(/2025 no record|2025 kayıt yok/i)).toBeVisible();
    await expect(page.getByText(/2026 given|2026 yapıldı/i)).toBeVisible();
  });

  test("says nothing about an animal whose record cannot answer", async ({ page }) => {
    await signUp(page, Date.now() + 2);
    await createDog(page);

    // A fresh animal: no doses, so no position and no pattern. Silence
    // is the honest answer and an empty block would be a promise.
    await expect(page.getByText(/series: \d\/\d|serisi: \d\/\d/)).toHaveCount(0);
    await expect(page.getByText(/records, year by year|kayıtları, yıl yıl/i)).toHaveCount(0);
  });
});
