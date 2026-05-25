import { test, expect } from "@playwright/test";

async function signUp(page: import("@playwright/test").Page, stamp: number) {
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

test.describe("Clients", () => {
  test("creating a client takes the user to its detail page", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    await page.goto("/clients/new");
    await page.getByLabel(/first name|^ad$/i).fill("Jamie");
    await page.getByLabel(/last name|soyad/i).fill("Rivera");
    await page.getByLabel(/^email$/i).fill("jamie@example.com");
    await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();

    await expect(page).toHaveURL(/\/clients\/[\w-]+$/);
    await expect(
      page.getByRole("heading", { name: /jamie rivera/i }),
    ).toBeVisible();
  });

  test("the clients list shows the newly created client", async ({ page }) => {
    await signUp(page, Date.now());

    await page.goto("/clients/new");
    await page.getByLabel(/first name|^ad$/i).fill("Avery");
    await page.getByLabel(/last name|soyad/i).fill("Chen");
    await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
    await expect(page).toHaveURL(/\/clients\/[\w-]+$/);

    await page.goto("/clients");
    await expect(page.getByText("Avery Chen")).toBeVisible();
  });
});
