import { pickOption, test, expect, assertFormKept } from "./helpers";
import type { Page } from "@playwright/test";

/**
 * The vet's round-three findings that a database has to answer, end to
 * end: a drug matching the animal's allergy is refused until a reason is
 * given, and an animal marked as deceased is no longer offered work.
 */

async function signUp(page: Page, stamp: number) {
  await page.goto("/sign-up");
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
  await page.getByLabel(/your name|adınız/i).fill("E2E Tester");
  await page.getByLabel(/^e-?mail$|^e-posta$/i).fill(`safety+${stamp}@pettrack.test`);
  await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
  await assertFormKept(page);
  await page.getByRole("button", { name: /create account|hesap oluştur/i }).click();
  await expect(page).toHaveURL("/");
}

async function createCatWithAllergy(page: Page) {
  await page.goto("/clients/new");
  await page.getByLabel(/first name|^ad$/i).fill("Deniz");
  await page.getByLabel(/last name|soyad/i).fill("Yılmaz");
  await page.getByLabel(/^phone$|^telefon$/i).fill("0532 765 43 21");
  await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
  await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);

  await page.goto("/pets/new");
  await pickOption(page, page.getByLabel(/^owner$|^sahibi$/i));
  await page.getByLabel(/^name$|^[İi]sim$/i).fill("Pamuk");
  await page.getByRole("button", { name: /^cat$|^kedi$/i }).click();
  // On the form's first screen, not behind "optional details": it is the
  // field every prescription is checked against.
  await page.getByLabel(/^medical alerts|^tıbbi uyarılar/i).fill("AMOKSİSİLİN ALERJİSİ");
  await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();
  await expect(page).toHaveURL(/\/pets\/(?!new)[\w-]+$/);
}

test.describe("Clinical safety", () => {
  test("a drug matching the allergy is refused until the vet says why", async ({ page }) => {
    await signUp(page, Date.now());
    await createCatWithAllergy(page);

    const rx = page.locator("details", { hasText: /new prescription|yeni reçete/i });
    await rx.locator("summary").click();
    await rx.getByLabel(/^medication|^[İi]laç/i).fill("Amoksisilin + Klavulanik asit");
    await rx.getByLabel(/^dose|^doz/i).fill("62,5 mg");
    await rx.getByLabel(/^frequency|^sıklık/i).fill("2x1");

    const conflict = rx.locator("[data-allergy-conflict]");
    await expect(conflict).toContainText("AMOKSİSİLİN ALERJİSİ");
    await expect(conflict).toContainText("Amoksisilin + Klavulanik asit");

    // Without a reason the browser holds the save; with one it goes.
    const anyway = rx.getByRole("button", { name: /write it anyway|yine de yaz/i });
    await anyway.click();
    await expect(rx.getByLabel(/reason|gerekçe/i)).toBeFocused();
    await rx.getByLabel(/reason|gerekçe/i).fill("Alerji öyküsü sahiple doğrulandı, kayıt hatalı");
    await anyway.click();

    await expect(
      page.getByText(/written despite the recorded alert|kayıtlı uyarıya rağmen yazıldı/i),
    ).toBeVisible();
  });

  test("an animal marked as deceased is no longer booked, and can be unmarked", async ({
    page,
  }) => {
    await signUp(page, Date.now() + 1);
    await createCatWithAllergy(page);
    const petUrl = page.url();

    await expect(page.getByRole("link", { name: /new appointment|yeni randevu/i })).toBeVisible();
    await page.getByRole("button", { name: /mark as deceased|vefat etti olarak işaretle/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^note|^not/i).fill("Evde, yaşlılık");
    await dialog.getByRole("button", { name: /mark as deceased|vefat etti olarak işaretle/i }).click();

    await expect(page.getByText(/^deceased ·|^vefat etti ·/i)).toBeVisible();
    await expect(page.getByText("Evde, yaşlılık")).toBeVisible();
    await expect(page.getByRole("link", { name: /new appointment|yeni randevu/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /new visit|yeni vizit/i })).toHaveCount(0);

    // The booking form does not offer it (the server would refuse it):
    // with its only animal deceased, this clinic has nothing to book.
    await page.goto("/appointments/new");
    await expect(page.getByRole("heading", { name: /a pet comes first|önce hayvan gerekir/i })).toBeVisible();

    await page.goto(petUrl);
    await page.getByRole("button", { name: /marked by mistake|yanlışlıkla işaretlendi/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^undo$|^geri al$/i }).click();
    await expect(page.getByRole("link", { name: /new appointment|yeni randevu/i })).toBeVisible();
  });
});
