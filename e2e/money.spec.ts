import { test, expect, type Page } from "@playwright/test";

// Money, end to end: what a person types must be what the clinic is owed.
//
// Two deploy blockers live on this path. A payment of 500 was stored as 5,00
// because the amount was read as cents, and the dashboard added up what was
// billed instead of what is still owed. Both were silent: nothing failed, the
// numbers were simply wrong.
//
// Amounts are matched on their digits (500[.,]00) so the assertions hold in
// either locale and whatever currency the clinic is set to.

async function signUp(page: Page, stamp: number) {
  await page.goto("/sign-up");
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Money Clinic ${stamp}`);
  await page.getByLabel(/your name|adınız/i).fill("E2E Tester");
  await page.getByLabel(/^e-?mail$|^e-posta$/i).fill(`money+${stamp}@pettrack.test`);
  await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
  await page.getByRole("button", { name: /create account|hesap oluştur/i }).click();
  await expect(page).toHaveURL("/");
}

async function createClient(page: Page) {
  await page.goto("/clients/new");
  await page.getByLabel(/first name|^ad$/i).fill("Deniz");
  await page.getByLabel(/last name|soyad/i).fill("Yılmaz");
  await page.getByLabel(/^phone$|^telefon$/i).fill("0532 123 45 67");
  await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
  await expect(page).toHaveURL(/\/clients\/[\w-]+$/);
}

test.describe("Money is stored as the amount that was typed", () => {
  test("payment, outstanding balance and dashboard agree", async ({ page }) => {
    await signUp(page, Date.now());
    await createClient(page);

    // An invoice of 2 × 500 = 1000.
    await page.goto("/invoices/new");
    await page.getByLabel(/^client$|^müşteri$/i).selectOption({ index: 1 });
    await page.getByPlaceholder(/description|açıklama/i).fill("Muayene");
    await page.getByPlaceholder(/^qty$|^adet$/i).fill("2");
    await page.getByPlaceholder(/unit price|birim fiyat/i).fill("500");
    await page.getByRole("button", { name: /save invoice|faturayı kaydet/i }).click();
    await expect(page).toHaveURL(/\/invoices\/[\w-]+$/);

    // 500 is five hundred, not five: the total is 1000, not 10.
    await expect(page.getByText(/1[.,]000[.,]00/).first()).toBeVisible();

    // Pay 500 of it.
    // The form that owns the amount field, rather than "the last div that
    // mentions the heading": that div is the card header, which holds the
    // heading and nothing else.
    const paymentCard = page.locator("form", {
      has: page.locator('input[name="amount"]'),
    });
    await paymentCard.getByLabel(/^amount$|^tutar$/i).fill("500");
    await paymentCard.getByRole("button", { name: /^record$|^kaydet$/i }).click();

    // The outstanding card must read 500,00 — with the old bug the payment
    // landed as 5,00 and 995,00 stayed owed.
    const outstanding = page
      .locator("div")
      .filter({ hasText: /^(outstanding|ödenmemiş)$/i })
      .locator("xpath=../..");
    await expect(outstanding.getByText(/(^|[^\d.,])500[.,]00/).first()).toBeVisible();

    // Sub-cent precision is refused, not rounded and not read as thousands:
    // in Turkish "10,999" is ten lira and 99,9 kuruş, and it used to be
    // stored as 10.999,00 — a 250 lira invoice paid off in one keystroke.
    // "0,001" is the same mistake in a form both locales reject: in Turkish
    // it has three decimals, in English a thousands group that starts with
    // a zero. ("10,999" is a valid ten thousand in English.)
    await paymentCard.getByLabel(/^amount$|^tutar$/i).fill("0,001");
    await paymentCard.getByRole("button", { name: /^record$|^kaydet$/i }).click();
    await expect(
      page.getByText(/enter a valid amount|geçerli bir tutar/i).first(),
    ).toBeVisible();

    // The dashboard owes the same number: payments are subtracted from what
    // was billed, so the card shows 500,00 and not the invoice's 1.000,00.
    await page.goto("/");
    const card = page.getByRole("link").filter({ hasText: /outstanding|ödenmemiş/i }).first();
    await expect(card).toContainText(/(^|[^\d.,])500[.,]00/);
    await expect(card).not.toContainText(/1[.,]000[.,]00/);
  });
});
