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

    await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);
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
    await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);

    await page.goto("/clients");
    await expect(page.getByText("Avery Chen")).toBeVisible();
  });

  // Backlog 39: "Archive" was a one-way door. The record left every list,
  // nothing rendered `restoreClientAction`, and the only way back was the
  // database. The round trip is the test.
  test("an archived client can be found again and restored", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    await page.goto("/clients/new");
    await page.getByLabel(/first name|^ad$/i).fill("Robin");
    await page.getByLabel(/last name|soyad/i).fill("Vale");
    await page
      .getByRole("button", { name: /create client|müşteri oluştur/i })
      .click();
    await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);

    await page.getByRole("button", { name: /^archive$|^arşivle$/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^archive$|^arşivle$/i })
      .click();
    // Archiving keeps the record on screen, with the way back on it; the
    // list is where the client has gone from.
    await expect(
      page.getByRole("button", { name: /restore from archive|arşivden çıkar/i }),
    ).toBeVisible();
    await page.goto("/clients");
    await expect(page.getByText("Robin Vale")).toBeHidden();

    // The filter is the way back in: without it the record exists and is
    // unreachable, which is the same as gone.
    await page
      .getByRole("link", { name: /with archived|arşiv dahil/i })
      .click();
    await expect(page.getByText("Robin Vale")).toBeVisible();

    await page.getByRole("link", { name: "Robin Vale" }).click();
    await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);
    const restore = page.getByRole("button", {
      name: /restore from archive|arşivden çıkar/i,
    });
    await restore.click();
    // The restore is a server action; navigating away before it has answered
    // aborts it, and the list would then honestly show nothing. The archive
    // notice, and the button in it, leave the page once the record is back.
    await expect(restore).toBeHidden();

    await page.goto("/clients");
    await expect(page.getByText("Robin Vale")).toBeVisible();
  });
});
