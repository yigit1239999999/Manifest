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

// The number, in every one of these. It is not decoration on the way to
// what each test is about: the counter form asks for a phone or for the
// box that says there is none, and a client with neither is refused by
// the schema (`modules/clients/schema.ts`). Three of these were written
// before that rule existed and were failing on it in silence.
const PHONE = "0532 111 22 33";

test.describe("Clients", () => {
  test("creating a client takes the user to its detail page", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    await page.goto("/clients/new");
    await page.getByLabel(/first name|^ad$/i).fill("Jamie");
    await page.getByLabel(/last name|soyad/i).fill("Rivera");
    await page.getByLabel(/^phone$|^telefon$/i).first().fill(PHONE);
    // The email lives behind the fold now: nine fields a counter does
    // not stop for while somebody is standing there.
    await page.getByText(/optional details|isteğe bağlı bilgiler/i).click();
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
    // No number, said out loud: the owner who will not give one is the
    // case the tick exists for, and it has to reach the list like any
    // other client.
    await page.getByRole("checkbox", { name: /no number|şimdi yok/i }).check();
    await page.getByRole("button", { name: /create client|müşteri oluştur/i }).click();
    await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);

    await page.goto("/clients");
    await expect(page.getByText("Avery Chen")).toBeVisible();
  });

  /**
   * The client who has no number, from birth to their own edit screen.
   *
   * The lock this is about is not the save that makes them -- that one
   * was obviously in scope -- but the one six months later. The counter
   * form and the edit form are the same component over the same schema
   * (`modules/clients/actions.ts` uses `clientSchema` for both), so a
   * rule loosened in one place and not the other produces a record that
   * can be created and then never saved again: somebody opens it to fix
   * an address and the form demands a number the clinic has never had.
   *
   * Nothing red would have said so. The defect waits for the second
   * visit to that record, which is why it is walked here rather than
   * reasoned about: create without a number, reopen, save.
   */
  test("a client with no number can still be edited later", async ({ page }) => {
    await signUp(page, Date.now());

    await page.goto("/clients/new");
    await page.getByLabel(/first name|^ad$/i).fill("Ayse");
    await page
      .getByRole("checkbox", { name: /no number|numarası yok/i })
      .check();
    await page
      .getByRole("button", { name: /create client|müşteri oluştur/i })
      .click();
    await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);
    const record = page.url();

    await page.goto(`${record}/edit`);
    // The absence comes back as the fact it is, rather than as an empty
    // box the form is about to ask them to fill.
    await expect(
      page.getByRole("checkbox", { name: /no number|numarası yok/i }),
    ).toBeChecked();

    await page
      .getByRole("button", { name: /save changes|^kaydet$/i })
      .first()
      .click();

    await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);
    await expect(page.getByRole("main")).toContainText("Ayse");
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
    await page.getByLabel(/^phone$|^telefon$/i).first().fill(PHONE);
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
