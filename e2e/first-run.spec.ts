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

// A clinic on its first day has no clients and no animals, so all four
// `/new` routes sit past the end of the chain client → pet → record. Three
// of them used to open a form whose picker was empty with no explanation.
// Each has to name the missing link and hand over the route that makes it;
// which link differs, and a bill needs only a client.
const guards = [
  { path: "/pets/new", says: /a client comes first|önce müşteri gerekir/i, to: "/clients/new" },
  { path: "/invoices/new", says: /a client comes first|önce müşteri gerekir/i, to: "/clients/new" },
  { path: "/appointments/new", says: /a pet comes first|önce hayvan gerekir/i, to: "/pets/new" },
  { path: "/visits/new", says: /a pet comes first|önce hayvan gerekir/i, to: "/pets/new" },
];

test.describe("First run", () => {
  test("every /new route names the record that is missing", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    for (const guard of guards) {
      await page.goto(guard.path);
      const main = page.getByRole("main");
      await expect(main.getByText(guard.says)).toBeVisible();
      // The way out, and no form to guess at behind it.
      await expect(main.getByRole("link").last()).toHaveAttribute(
        "href",
        guard.to,
      );
      await expect(main.getByRole("combobox")).toHaveCount(0);
    }
  });
});
