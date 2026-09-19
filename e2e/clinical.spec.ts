import { test, expect, type Page } from "@playwright/test";

// The clinical happy path against a real, migrated database: a client, a pet
// registered through the species picker, then a vaccination, a treatment and
// a diagnostic test added in place on the pet page. Guards the tables and
// server actions behind every "add" form on that screen.

async function signUp(page: Page, stamp: number) {
  await page.goto("/sign-up");
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
  await page.getByLabel(/your name|adınız/i).fill("E2E Tester");
  await page.getByLabel(/^e-?mail$|^e-posta$/i).fill(`e2e+${stamp}@pettrack.test`);
  await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
  await page.getByRole("button", { name: /create account|hesap oluştur/i }).click();
  await expect(page).toHaveURL("/");
}

async function createClient(page: Page) {
  await page.goto("/clients/new");
  await page.getByLabel(/first name|^ad$/i).fill("Nisa");
  await page.getByLabel(/last name|soyad/i).fill("Sonbahar");
  await page.getByLabel(/^phone$|^telefon$/i).fill("0532 123 45 67");
  await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
  await expect(page).toHaveURL(/\/clients\/[\w-]+$/);
}

async function createPet(page: Page) {
  await page.goto("/pets/new");
  await page.getByLabel(/^owner$|^sahibi$/i).selectOption({ index: 1 });
  await page.getByLabel(/^name$|^isim$/i).fill("Sarı");
  await page.getByRole("button", { name: /^cat$|^kedi$/i }).click();
  await page.getByLabel(/^breed$|^cins$/i).fill("Tekir");
  await page.getByLabel(/^sex$|^cinsiyet$/i).selectOption("MALE");
  await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();
  await expect(page).toHaveURL(/\/pets\/[\w-]+$/);
  await expect(page.getByRole("heading", { name: "Sarı" })).toBeVisible();
}

test.describe("Clinical records on the pet page", () => {
  test("vaccination, treatment and diagnostic can be added in place", async ({ page }) => {
    await signUp(page, Date.now());
    await createClient(page);
    await createPet(page);

    // Vaccination
    const vacc = page.locator("details", { hasText: /add vaccination|aşı ekle/i });
    await vacc.locator("summary").click();
    await vacc.getByLabel(/^vaccine$|^aşı$/i).fill("Karma aşı");
    await vacc.getByRole("button", { name: /save vaccination|aşıyı kaydet/i }).click();
    await expect(page.getByText("Karma aşı")).toBeVisible();

    // Treatment (searchable combobox, free text allowed)
    const treat = page.locator("details", { hasText: /add treatment|tedavi \/ işlem ekle/i });
    await treat.locator("summary").click();
    await treat.getByLabel(/treatment \/ procedure|tedavi \/ işlem/i).fill("Tırnak kesimi");
    await treat.getByRole("button", { name: /^save$|^kaydet$/i }).click();
    await expect(page.getByText("Tırnak kesimi")).toBeVisible();

    // Diagnostic test (type-driven combobox)
    const diag = page.locator("details", { hasText: /add test|test ekle/i });
    await diag.locator("summary").click();
    await diag.getByLabel(/test type|test türü/i).selectOption("BLOOD");
    await diag.getByLabel(/^test$/i).fill("Hemogram");
    await diag.getByRole("button", { name: /^save$|^kaydet$/i }).click();
    await expect(page.getByText("Hemogram")).toBeVisible();
  });
});
