import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("an unauthenticated visitor is sent to /sign-in", async ({ page }) => {
    const response = await page.goto("/clients", { waitUntil: "networkidle" });
    // Either a redirect chain landed on /sign-in, or the page just rendered it.
    expect(page.url()).toMatch(/\/sign-in$/);
    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: /welcome back|tekrar hoş geldin/i }),
    ).toBeVisible();
  });

  test("a fresh clinic can sign up, sign out and sign back in", async ({
    page,
  }) => {
    const stamp = Date.now();
    const email = `e2e+${stamp}@pettrack.test`;
    const password = "supersecret123";

    await page.goto("/sign-up");
    await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
    await page.getByLabel(/your name|adın/i).fill("E2E Tester");
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password|^şifre/i).fill(password);
    await page
      .getByRole("button", { name: /create account|hesap oluştur/i })
      .click();

    await expect(page).toHaveURL("/");
    // The dashboard greets with the user's first name ("Hi, E2E" / "Merhaba E2E").
    await expect(
      page.getByRole("heading", { name: /e2e/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /sign out|çıkış/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password|^şifre/i).fill(password);
    await page.getByRole("button", { name: /sign in|giriş/i }).click();
    await expect(page).toHaveURL("/");
  });
});
