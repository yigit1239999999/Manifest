import { pickOption, test, expect, assertFormKept } from "./helpers";

// The third round's daily-work changes, walked as a clinic would: the
// dashboard's today, the duplicate-client warning, an owner change that
// has to be confirmed, and the phone's bottom bar.

async function signUp(page: import("@playwright/test").Page, stamp: number) {
  await page.goto("/sign-up");
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
  await page.getByLabel(/your name|adın/i).fill("E2E Tester");
  await page.getByLabel(/^e-?mail$|^e-posta$/i).fill(`e2e+daily${stamp}@pettrack.test`);
  await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
  await assertFormKept(page);
  await page.getByRole("button", { name: /create account|hesap oluştur/i }).click();
  await expect(page).toHaveURL("/");
}

async function createClient(
  page: import("@playwright/test").Page,
  first: string,
  last: string,
  phone: string,
) {
  await page.goto("/clients/new");
  await page.getByLabel(/first name|^ad$/i).fill(first);
  await page.getByLabel(/last name|soyad/i).fill(last);
  await page.getByLabel(/^phone$|^telefon$/i).first().fill(phone);
  await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
  await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);
}

async function createPet(page: import("@playwright/test").Page, owner: string, name: string) {
  await page.goto("/pets/new");
  await pickOption(page, page.getByLabel(/^owner$|^sahibi$/i), owner);
  await page.getByLabel(/^name$|^[İi]sim$/i).fill(name);
  await page.getByRole("button", { name: /^cat$|^kedi$/i }).click();
  await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();
  await expect(page.getByRole("heading", { name: new RegExp(name, "i") })).toBeVisible();
}

/** "YYYY-MM-DD" for today in the clinic's zone. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

test.describe("A clinic's day", () => {
  test("today's appointment is on the dashboard and stays there once the animal has come", async ({
    page,
  }) => {
    await signUp(page, Date.now());
    await createClient(page, "Ayse", "Yilmaz", "0532 111 22 33");
    await createPet(page, "Ayse", "Boncuk");

    // A minute past midnight: today, and already past, so both outcomes
    // are offered.
    await page.goto("/appointments/new");
    await pickOption(page, page.getByLabel(/^pet$|^hayvan$/i));
    await page.getByLabel(/starts at|başlangıç/i).fill(`${today()}T00:01`);
    await page.getByRole("button", { name: /create appointment|randevu oluştur/i }).click();
    await expect(page).toHaveURL(/\/appointments\/(?!new)[\w-]+$/);

    await page.goto("/");
    const main = page.getByRole("main");
    await expect(main.getByRole("button", { name: /^(arrived|geldi): boncuk/i })).toBeVisible();
    await expect(main.getByRole("button", { name: /^(no-show|gelmedi): boncuk/i })).toBeVisible();

    await main.getByRole("button", { name: /^(arrived|geldi): boncuk/i }).click();
    await expect(page.getByText(/boncuk (marked as arrived|geldi olarak)/i)).toBeVisible();
    // Still on the dashboard, now as arrived, with the visit one tap away.
    await expect(main.getByRole("link", { name: /^(start visit|vizite başla): boncuk/i })).toBeVisible();
    await expect(main.getByRole("button", { name: /^(arrived|geldi): boncuk/i })).toHaveCount(0);
  });

  test("a second record for the same number is warned about and needs saying so", async ({
    page,
  }) => {
    await signUp(page, Date.now());
    await createClient(page, "Ayse", "Tekin", "0532 411 22 33");

    // The same number written another way, which search used to miss.
    await page.goto("/clients?q=" + encodeURIComponent("05324112233"));
    await expect(page.getByRole("link", { name: /ayse tekin/i })).toBeVisible();

    await page.goto("/clients/new");
    await page.getByLabel(/first name|^ad$/i).fill("Ayşe");
    await page.getByLabel(/^phone$|^telefon$/i).first().fill("+90 (532) 411-22-33");
    await page.getByLabel(/last name|soyad/i).click();
    await expect(page.getByText(/on file with this number|bu numarayla kayıtlı/i)).toBeVisible();

    await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
    await expect(page).toHaveURL(/\/clients\/new/);

    await page.getByLabel(/a different person|farklı bir kişi/i).check();
    await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
    await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);
  });

  test("moving an animal to another owner is confirmed and noted on both", async ({ page }) => {
    await signUp(page, Date.now());
    await createClient(page, "Elif", "Kaya", "0532 222 33 44");
    await createClient(page, "Mehmet", "Arslan", "0532 333 44 55");
    await createPet(page, "Elif", "Pamuk");

    await page.getByRole("link", { name: /^(edit|düzenle)$/i }).click();
    await pickOption(page, page.getByLabel(/^owner$|^sahibi$/i), "Mehmet");
    await expect(page.getByText(/the owner will change|sahip değişecek/i)).toBeVisible();
    await page.getByLabel(/yes, change the owner|evet, sahibini değiştir/i).check();
    await page.getByRole("button", { name: /save changes|kaydet/i }).last().click();
    await expect(page).toHaveURL(/\/pets\/(?!new)[\w-]+$/);

    await page.goto("/clients?q=Elif");
    await page.getByRole("link", { name: /elif kaya/i }).click();
    await expect(page.getByText(/owner changed \(pamuk\)|sahip değişti \(pamuk\)/i)).toBeVisible();
  });

  test("a phone gets a labelled bottom bar and no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUp(page, Date.now());
    const bar = page.getByRole("navigation", { name: /main navigation|ana gezinme/i }).last();
    await expect(bar.getByRole("link", { name: /appointments|randevular/i })).toBeVisible();
    await bar.getByRole("button", { name: /^(more|diğer)$/i }).click();
    await page.getByRole("dialog").getByRole("link", { name: /invoices|faturalar/i }).click();
    await expect(page).toHaveURL(/\/invoices/);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
