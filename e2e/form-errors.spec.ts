import { pickOption, test, expect } from "./helpers";

// A failed validation must never cost the user their typing, and the
// messages that come back must be in the language they are using.

async function signUp(page: import("@playwright/test").Page, stamp: number) {
  await page.goto("/sign-up");
  await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
  await page.getByLabel(/your name|adın/i).fill("E2E Tester");
  await page.getByLabel(/^e-?mail$|^e-posta$/i).fill(`e2e+${stamp}@pettrack.test`);
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
  // Or the box that says there is no number: the counter form asks for
  // one or the other, and this helper was giving neither.
  await page.getByLabel(/^phone$|^telefon$/i).first().fill("0532 111 22 33");
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
    await pickOption(page, owner, "Ayse");
    const name = page.getByLabel(/^name$|^[İi]sim$/i);
    await name.fill("Boncuk");

    // Optional details count too: a textarea and a checkbox.
    await page.getByText(/optional details|[İi]steğe bağlı detaylar/i).first().click();
    const notes = page.getByLabel(/^notes$|^notlar$/i);
    await notes.fill("Allergic to penicillin");
    const neutered = page.getByLabel(/neutered|kısırlaştırılmış/i);
    await neutered.check();

    // Species is left empty on purpose.
    await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();

    // Once in the summary at the top, once beside the field.
    const speciesError = page
      .getByText(/species is required|tür gerekli|select species|tür seçiniz/i)
      .first();
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
    await expect(page).toHaveURL(/\/pets\/(?!new)[\w-]+$/);
    await expect(page.getByRole("heading", { name: /boncuk/i })).toBeVisible();
  });

  test("shows server-side validation messages in the UI language", async ({
    page,
  }) => {
    await signUp(page, Date.now() + 1);
    await createOwner(page);

    await page.goto("/pets/new");
    // The current language is shown as pressed, not disabled.
    const english = page.getByRole("button", { name: "EN", exact: true });
    if ((await english.getAttribute("aria-pressed")) !== "true") {
      await english.click();
    }
    await expect(english).toHaveAttribute("aria-pressed", "true");

    // Owner and name are filled so the browser lets the form through; the
    // empty species is caught on the server.
    await pickOption(page, page.getByLabel(/^owner$|^sahibi$/i), "Ayse");
    await page.getByLabel(/^name$|^[İi]sim$/i).fill("Boncuk");
    await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();

    await expect(
      page.getByText(/species is required|select species/i).first(),
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
    await pickOption(page, page.getByLabel(/^owner$|^sahibi$/i), "Ayse");
    await page.getByLabel(/^name$|^[İi]sim$/i).fill("Boncuk");
    await page.getByRole("button", { name: /^cat$|^kedi$/i }).click();
    await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();
    await expect(page).toHaveURL(/\/pets\/(?!new)[\w-]+$/);

    await page.getByText(/add vaccination|aşı ekle/i).click();
    const vaccination = page.locator("form").filter({
      has: page.getByRole("button", { name: /save vaccination|aşıyı kaydet/i }),
    });
    await vaccination.getByLabel(/^vaccine$|^aşı$/i).fill("Rabies");
    await vaccination.getByLabel(/manufacturer|üretici/i).fill("Acme");
    await page.getByRole("button", { name: /save vaccination|aşıyı kaydet/i }).click();

    await expect(page.getByText("Rabies").first()).toBeVisible();
    await page.reload();
    await expect(page.getByText("Rabies").first()).toBeVisible();
  });
});

test.describe("Clinic time zone", () => {
  // The screen and the WhatsApp message have to agree, and both have to
  // agree with what the vet typed. They used to disagree by three hours:
  // the screen followed the server's clock, the message the clinic's.
  test("an appointment keeps the time it was booked for", async ({ page }) => {
    await signUp(page, Date.now() + 3);

    await page.goto("/clients/new");
    await page.getByLabel(/first name|^ad$/i).fill("Ayse");
    await page.getByLabel(/last name|soyad/i).fill("Yilmaz");
    await page.getByLabel(/^phone$|^telefon$/i).fill("+905321112233");
    // By role and by the words the counter reads out. This asked for
    // "gave consent", which is how the consent state is REPORTED on a
    // record's page; the question a receptionist puts to somebody
    // standing in front of them is answered yes or no, and the two
    // vocabularies are deliberately separate (`consent-choice.tsx`).
    await page.getByRole("radio", { name: /^(yes|evet)$/i }).check();
    await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
    await expect(page.getByRole("heading", { name: /ayse yilmaz/i })).toBeVisible();

    await page.goto("/pets/new");
    await pickOption(page, page.getByLabel(/^owner$|^sahibi$/i), "Ayse");
    await page.getByLabel(/^name$|^[İi]sim$/i).fill("Boncuk");
    await page.getByRole("button", { name: /^cat$|^kedi$/i }).click();
    await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();
    await expect(page.getByRole("heading", { name: /boncuk/i })).toBeVisible();

    await page.goto("/appointments/new");
    await pickOption(page, page.getByLabel(/^pet$|^hayvan$/i));
    await page.getByLabel(/starts at|başlangıç/i).fill("2026-11-23T11:30");
    await page.getByRole("button", { name: /create appointment|randevu oluştur/i }).click();
    await expect(page).toHaveURL(/\/appointments\/(?!new)[\w-]+$/);

    // The heading, the details row and the message all say 11:30.
    await expect(page.getByText("11:30").first()).toBeVisible();
    await page.getByText(/view message|mesajı görüntüle/i).first().click();
    await expect(page.getByText(/11:30/).nth(1)).toBeVisible();
    await expect(page.getByText(/08:30/)).toHaveCount(0);
  });
});

test.describe("Saving without leaving the page", () => {
  // The list has to show what was just saved; when it kept saying "none"
  // people saved the same reminder twice.
  test("a new reminder appears in the list straight away", async ({ page }) => {
    await signUp(page, Date.now() + 4);
    await createOwner(page);

    await page.goto("/reminders");
    await pickOption(page, page.getByLabel(/^client$|^müşteri$/i));
    await page.getByLabel(/^name$|^title$|^başlık$/i).fill("Rabies booster due");
    await page.getByRole("button", { name: /create reminder|hatırlatma oluştur/i }).click();

    await expect(page.getByText("Rabies booster due")).toBeVisible();
    await expect(page.getByText(/no reminders/i)).toHaveCount(0);

    // Closing and reopening keep the list in step as well. A closed row
    // leaves the open list and is found under "Closed"; reopened, it comes
    // back. Each step is a server action followed by a client refresh
    // (components/forms/use-refresh-action.ts).
    // The separator is read from the product rather than guessed: the
    // accessible name is `common.actionFor` = "{action}: {subject}", so it
    // is a colon and a space in both languages.
    //
    // It used to be `\b` after the alternation, and that could never match
    // the Turkish label: `\b` is defined on [A-Za-z0-9_], and "geri aç"
    // ends in `ç`, which is not in that class, so there is no boundary to
    // find. "Tamam" happened to work, which is why only one of the two
    // fell. Same family as the `İ` trap -- a pattern that reads as
    // bilingual and is not.
    //
    // (My first fix guessed `[\s·]` for the separator and broke the half
    // that had been passing. Reading `actionFor` would have taken less
    // time than the run that caught it.)
    const done = page.getByRole("button", {
      name: /^(mark done|tamam): .*rabies booster due/i,
    });
    const reopen = page.getByRole("button", {
      name: /^(reopen|geri aç): .*rabies booster due/i,
    });
    await done.click();
    await expect(done).toBeHidden();

    await page.goto("/reminders?status=closed");
    await reopen.click();
    await expect(reopen).toBeHidden();

    await page.goto("/reminders");
    await expect(done).toBeVisible();
  });
});
