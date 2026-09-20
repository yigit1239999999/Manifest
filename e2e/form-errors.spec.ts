import { test, expect } from "@playwright/test";

// A failed validation must never cost the user their typing, and the
// messages that come back must be in the language they are using.

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

async function createOwner(page: import("@playwright/test").Page) {
  await page.goto("/clients/new");
  await page.getByLabel(/first name|^ad$/i).fill("Ayse");
  await page.getByLabel(/last name|soyad/i).fill("Yilmaz");
  await page
    .getByRole("button", { name: /create client|müşteri oluştur/i })
    .click();
  await expect(page.getByRole("heading", { name: /ayse yilmaz/i })).toBeVisible();
}

test.describe("Form validation", () => {
  test("keeps what was typed and clears the error once the field is fixed", async ({
    page,
  }) => {
    await signUp(page, Date.now());
    await createOwner(page);

    await page.goto("/pets/new");
    const owner = page.getByLabel(/owner|sahibi/i);
    await owner.selectOption({ label: "Ayse Yilmaz" });
    const name = page.getByLabel(/^name$|^i̇sim$|^isim$/i);
    await name.fill("Boncuk");

    // Optional details count too: a textarea and a checkbox.
    await page.getByText(/optional details|i̇steğe bağlı detaylar/i).first().click();
    const notes = page.getByLabel(/^notes$|^notlar$/i);
    await notes.fill("Allergic to penicillin");
    const neutered = page.getByLabel(/neutered|kısırlaştırılmış/i);
    await neutered.check();

    // Species is left empty on purpose.
    await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();

    const speciesError = page.getByText(
      /species is required|tür gerekli|select species|tür seçiniz/i,
    );
    await expect(speciesError).toBeVisible();

    // Nothing the user filled in may be lost.
    await expect(name).toHaveValue("Boncuk");
    await expect(owner).not.toHaveValue("");
    await expect(notes).toHaveValue("Allergic to penicillin");
    await expect(neutered).toBeChecked();

    // Fixing the field takes its message away immediately.
    await page.getByRole("button", { name: /^cat$|^kedi$/i }).click();
    await expect(speciesError).toBeHidden();

    await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();
    await expect(page).toHaveURL(/\/pets\/[\w-]+$/);
    await expect(page.getByRole("heading", { name: /boncuk/i })).toBeVisible();
  });

  test("shows server-side validation messages in the UI language", async ({
    page,
  }) => {
    await signUp(page, Date.now() + 1);
    await createOwner(page);

    await page.goto("/pets/new");
    const english = page.getByRole("button", { name: "EN", exact: true });
    if (await english.isEnabled()) await english.click();
    await expect(english).toBeDisabled();

    // Owner and name are filled so the browser lets the form through; the
    // empty species is caught on the server.
    await page.getByLabel(/owner/i).selectOption({ label: "Ayse Yilmaz" });
    await page.getByLabel(/^name$/i).fill("Boncuk");
    await page.getByRole("button", { name: /create pet/i }).click();

    await expect(
      page.getByText(/species is required|select species/i),
    ).toBeVisible();
    await expect(page.getByText(/gerekli|seçiniz/i)).toHaveCount(0);
  });
});

test.describe("Medical records", () => {
  // Optional fields that the form does not render (visitId,
  // administeredById) used to reach the schema as `undefined` and drop the
  // whole submission without a word.
  test("a vaccination saves from the pet page", async ({ page }) => {
    await signUp(page, Date.now() + 2);
    await createOwner(page);

    await page.goto("/pets/new");
    await page.getByLabel(/owner/i).selectOption({ label: "Ayse Yilmaz" });
    await page.getByLabel(/^name$/i).fill("Boncuk");
    await page.getByRole("button", { name: /^cat$/i }).click();
    await page.getByRole("button", { name: /create pet/i }).click();
    await expect(page).toHaveURL(/\/pets\/[\w-]+$/);

    await page.getByText("Add vaccination").click();
    const vaccination = page.locator("form").filter({
      has: page.getByRole("button", { name: /save vaccination/i }),
    });
    await vaccination.getByLabel(/^vaccine$/i).fill("Rabies");
    await vaccination.getByLabel(/manufacturer/i).fill("Acme");
    await page.getByRole("button", { name: /save vaccination/i }).click();

    await expect(page.getByText("Rabies").first()).toBeVisible();
    await page.reload();
    await expect(page.getByText("Rabies").first()).toBeVisible();
  });
});
