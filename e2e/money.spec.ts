import { pickOption, test, expect, assertFormKept } from "./helpers";
import type { Page } from "@playwright/test";

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
  // "Clinic <stamp>", like every other spec. It used to be "Money
  // Clinic <stamp>", which reads better and is excluded from no
  // measurement at all: `loop-metrics.mjs` filters e2e clinics by
  // `^(Perf )?Clinic [0-9]{10,}$`, so every clinic this file has ever
  // created has been counted as a real one. `e2e/clinic-name.test.ts`
  // found it the first time it ran.
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
  await page.getByLabel(/your name|adınız/i).fill("E2E Tester");
  await page.getByLabel(/^e-?mail$|^e-posta$/i).fill(`money+${stamp}@pettrack.test`);
  await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
  await assertFormKept(page);
  await page.getByRole("button", { name: /create account|hesap oluştur/i }).click();
  await expect(page).toHaveURL("/");
}

async function createClient(page: Page) {
  await page.goto("/clients/new");
  await page.getByLabel(/first name|^ad$/i).fill("Deniz");
  await page.getByLabel(/last name|soyad/i).fill("Yılmaz");
  await page.getByLabel(/^phone$|^telefon$/i).fill("0532 123 45 67");
  await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
  // Not `[\w-]+`: that matches `/clients/new`, which is where the form
  // is standing while the save is still in flight -- so this waited for
  // a condition that was already true and walked on to an invoice the
  // client had not reached yet. The same trap `first-run.spec.ts`
  // names at its own redirect, and it only bites when the server is
  // slow enough to lose the race.
  await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);
}

test.describe("Money is stored as the amount that was typed", () => {
  test("payment, outstanding balance and dashboard agree", async ({ page }) => {
    await signUp(page, Date.now());
    await createClient(page);

    // An invoice of 2 × 500 = 1000.
    await page.goto("/invoices/new");
    await pickOption(page, page.getByLabel(/^client$|^müşteri$/i));
    // Labelled fields, not placeholders (B9).
    await page.getByLabel(/^description|^açıklama/i).fill("Muayene");
    await page.getByLabel(/^qty$|^adet$/i).fill("2");
    await page.getByLabel(/^unit price$|^birim fiyat$/i).fill("500");
    // The totals add up as the vet types, VAT worked out from a rate:
    // 1000 + 20% opens as 1.200, and 0% takes it back to 1.000.
    await expect(page.getByText(/1[.,]200[.,]00/).first()).toBeVisible();
    await page.getByLabel(/^vat rate$|^kdv oranı$/i).selectOption("0");
    await expect(page.getByText(/1[.,]200[.,]00/)).toHaveCount(0);
    await page.getByRole("button", { name: /save invoice|faturayı kaydet/i }).click();
    // Same trap as the client redirect above, and the same fix: the
    // bill's own page, not the form it was raised from.
    await expect(page).toHaveURL(/\/invoices\/(?!new)[\w-]+$/);

    // 500 is five hundred, not five: the total is 1000, not 10.
    await expect(page.getByText(/1[.,]000[.,]00/).first()).toBeVisible();
    // Numbered in sequence: the clinic's first invoice of the year.
    await expect(page.getByRole("heading", { name: /#\d{4}-0001/ })).toBeVisible();

    // Pay 500 of it.
    // The form that owns the amount field, rather than "the last div that
    // mentions the heading": that div is the card header, which holds the
    // heading and nothing else.
    const paymentCard = page.locator("form", {
      has: page.locator('input[name="amount"]'),
    });
    await paymentCard.getByLabel(/^amount$|^tutar$/i).fill("500");
    await paymentCard.getByRole("button", { name: /^record payment$|^ödemeyi kaydet$/i }).click();

    // The outstanding card must read 500,00 — with the old bug the payment
    // landed as 5,00 and 995,00 stayed owed. Once something is paid it is
    // titled "Kalan" rather than "Ödenmemiş" (C7).
    const outstanding = page
      .locator("div")
      .filter({ hasText: /^(outstanding|ödenmemiş|remaining|kalan)$/i })
      .locator("xpath=../..");
    await expect(outstanding.getByText(/(^|[^\d.,])500[.,]00/).first()).toBeVisible();

    // Sub-cent precision is refused, not rounded and not read as thousands:
    // in Turkish "10,999" is ten lira and 99,9 kuruş, and it used to be
    // stored as 10.999,00 — a 250 lira invoice paid off in one keystroke.
    // "0,001" is the same mistake in a form both locales reject: in Turkish
    // it has three decimals, in English a thousands group that starts with
    // a zero. ("10,999" is a valid ten thousand in English.)
    await paymentCard.getByLabel(/^amount$|^tutar$/i).fill("0,001");
    await paymentCard.getByRole("button", { name: /^record payment$|^ödemeyi kaydet$/i }).click();
    await expect(
      page.getByText(/enter a valid amount|geçerli bir tutar/i).first(),
    ).toBeVisible();

    // One digit too many is refused with what is actually left, not stored:
    // "5000" on the 500 still owed once closed the invoice as PAID.
    await paymentCard.getByLabel(/^amount$|^tutar$/i).fill("5000");
    await paymentCard.getByRole("button", { name: /^record payment$|^ödemeyi kaydet$/i }).click();
    await expect(
      page.getByText(/left to pay on this invoice|kalan borç .*500[.,]00\./i).first(),
    ).toBeVisible();
    await expect(outstanding.getByText(/(^|[^\d.,])500[.,]00/).first()).toBeVisible();
    const invoiceUrl = page.url();

    // A clean printed copy, with the payment on it as the receipt.
    await page.getByRole("link", { name: /^print$|^yazdır$/i }).click();
    await expect(page).toHaveURL(/\/print\/invoices\//);
    await expect(page.getByText(/payments received|tahsilat/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^print$|^yazdır$/i })).toBeVisible();
    await page.goto(invoiceUrl);

    // The dashboard owes the same number: payments are subtracted from what
    // was billed, so the card shows 500,00 and not the invoice's 1.000,00.
    await page.goto("/");
    const card = page.getByRole("link").filter({ hasText: /outstanding|ödenmemiş/i }).first();
    await expect(card).toContainText(/(^|[^\d.,])500[.,]00/);
    await expect(card).not.toContainText(/1[.,]000[.,]00/);

    // Voiding the payment keeps the row, struck through, and gives the
    // amount back to the balance.
    await page.goto(invoiceUrl);
    await page.getByRole("button", { name: /void the .*500[.,]00 payment|500[.,]00 tutarındaki ödemeyi iptal et/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^void payment$|^ödemeyi iptal et$/i })
      .click();
    // The voided row still shows its 500,00 struck through in the payment
    // list, so assert on the paid line rather than on the bare amount.
    await expect(outstanding).toContainText(/(paid|ödendi):\s*\D*0[.,]00\s*\//i);
    await expect(page.getByText(/^voided |^İptal edildi: /i).first()).toBeVisible();

    // Paid in full: no "unpaid 0,00" box, and no payment form (C7).
    await paymentCard.getByRole("button", { name: /pay in full|tamamını öde/i }).click();
    await paymentCard.getByRole("button", { name: /^record payment$|^ödemeyi kaydet$/i }).click();
    await expect(page.getByText(/^(paid in full|tamamı ödendi)$/i)).toBeVisible();
    await expect(page.locator("div").filter({ hasText: /^(outstanding|ödenmemiş|remaining|kalan)$/i })).toHaveCount(0);
    await expect(page.locator('input[name="amount"]')).toHaveCount(0);

    // Month-end: the list's totals and the till by method for this month.
    await page.goto("/invoices");
    await page.getByRole("link", { name: /^this month$|^bu ay$/i }).click();
    await expect(page.getByText(/^(billed|kesilen)$/i)).toBeVisible();
    await expect(page.getByText(/^(money taken on these dates|bu tarihlerde kasaya giren)$/i)).toBeVisible();
  });
});
