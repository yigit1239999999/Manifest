import path from "node:path";
import { test, expect } from "./helpers";
import { writeFixtures } from "./import-fixtures";

/**
 * The import screen, walked with real files.
 *
 * The files are built here rather than kept in the repository, and the
 * reason is the same one that shaped the whole feature: no clinic's export
 * has been seen, so a committed `typical-clinic-export.xlsx` would be a
 * claim about the world nobody is entitled to make (#16). Each fixture is
 * named after the mechanism it exercises, and `e2e/import-fixtures.ts`
 * is the same generator a person runs by hand to try the screen.
 *
 * What only a browser can check, and why these tests exist rather than more
 * unit tests: the file leaves the page, comes back as rows, and the screen
 * is built from them. The unit tests mock that round trip away.
 */
const dir = path.join(process.cwd(), "tmp/import-fixtures");
const file = (name: string) => path.join(dir, name);

test.beforeAll(async () => {
  await writeFixtures(dir);
});

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

async function openImport(page: import("@playwright/test").Page) {
  await signUp(page, Date.now());
  await page.goto("/import");
  return page.getByRole("main");
}

test.describe("Importing a spreadsheet", () => {
  test("reads the file and asks about the first row before anything else", async ({
    page,
  }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("header-row-is-names.xlsx"));

    await expect(
      // Capital dotted I, deliberately: JS `/i` does not fold `İ` onto `i`,
      // so the lowercase spelling of this leg matches nothing and the suite
      // stays green while only checking English (`e2e/locator-legs.test.ts`,
      // which caught exactly this one).
      main.getByText(/is the first row column names|İlk satır sütun adları mı/i),
    ).toBeVisible();
    // Nothing is decided for the vet: no field select exists until they
    // answer, because which rows are the body depends on the answer.
    await expect(main.locator("select")).toHaveCount(0);
    for (const radio of await main.getByRole("radio").all()) {
      await expect(radio).not.toBeChecked();
    }
  });

  test("shows the vet their own headings and their own values", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("header-row-is-names.xlsx"));
    await main.getByRole("radio").first().check();

    // Their heading, unedited.
    await expect(main.getByText("Sahibi", { exact: true })).toBeVisible();
    // Their value, with the spaces they typed. Masked samples exist for a
    // model, never for a person: `Xxxx Xxxxx` under "Adı" would hide the one
    // thing the vet is being asked to tell apart.
    await expect(main.getByText("0532 111 22 33").first()).toBeVisible();
    await expect(main.getByText(/Xxxx/)).toHaveCount(0);
  });

  test("says it cannot tell when nothing in the sheet can tell", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("all-text-no-comparable.xlsx"));

    await expect(
      main.getByText(/every column on this sheet is text|sütunların hepsi metin/i),
    ).toBeVisible();
    for (const radio of await main.getByRole("radio").all()) {
      await expect(radio).not.toBeChecked();
    }
  });

  test("asks which way a date-shaped column reads, and does not guess", async ({
    page,
  }) => {
    const main = await openImport(page);
    await main
      .locator('input[type="file"]')
      .setInputFiles(file("date-shaped-text-ambiguous.xlsx"));
    await main.getByRole("radio").first().check();

    const question = main.getByText(/is the day first|gün mü önce/i);
    await expect(question).toBeVisible();
    // Both answers offered, neither chosen. A default here would be the
    // product answering a question it has just said it cannot answer.
    const dayFirst = main.getByRole("radio", { name: /day first|önce gün/i });
    const monthFirst = main.getByRole("radio", { name: /month first|önce ay/i });
    await expect(dayFirst).not.toBeChecked();
    await expect(monthFirst).not.toBeChecked();
  });

  test("counts the blanks the file writes three different ways", async ({ page }) => {
    const main = await openImport(page);
    await main
      .locator('input[type="file"]')
      .setInputFiles(file("blanks-written-three-ways.xlsx"));
    await main.getByRole("radio").first().check();

    // Three rows, three spellings, one count -- and the markers named, so
    // the vet can see that "-" and "yok" were read as nothing.
    await expect(
      main.getByText(/counted as empty|boş sayıldı/i).first(),
    ).toBeVisible();
  });

  test("asks which sheet only when there is more than one", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("two-sheets.xlsx"));
    await expect(
      main.getByText(/which sheet should we read|hangi sayfayı okuyalım/i),
    ).toBeVisible();

    await main.locator('input[type="file"]').setInputFiles(file("header-row-is-names.xlsx"));
    await expect(
      main.getByText(/which sheet should we read|hangi sayfayı okuyalım/i),
    ).toHaveCount(0);
  });

  test("says so out loud when the file is over the limit", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("over-the-size-limit.xlsx"));

    // The one failure on this screen that looks like nothing if it is not
    // said: the request never leaves, so silence would read as a page that
    // simply did not respond.
    await expect(main.getByText(/over the .* limit|sınırını aşıyor/i)).toBeVisible();
  });

  test("ends in a summary of the file it read", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("header-row-is-names.xlsx"));
    await main.getByRole("radio").first().check();

    await expect(
      main.getByText(/rows were read|satır okundu/i),
    ).toBeVisible();
  });

  /**
   * The whole point of the feature, walked end to end: the rows the vet is
   * looking at become records, and the records can be taken back.
   *
   * Three things here can only be checked in a browser, and each of them
   * was a real risk rather than a ceremony. The rows have to survive the
   * trip to the server a SECOND time (the screen reads the file once and
   * then hands the same rows to the plan and to the write). The dedup has
   * to fold this fixture's two "Ayşe Yılmaz" rows into one client, which no
   * unit test of the planner can prove about the screen. And undo has to
   * empty a list that a moment ago had records in it -- the state a vet
   * ends up in when they regret the import.
   *
   * The selects are driven by id and by field VALUE rather than by their
   * labels: the answer is `pet.name` in both languages, and a locator
   * written in words would be a Turkish leg nobody ever runs (see
   * `e2e/locator-legs.test.ts`).
   */
  test("writes the rows, and takes them back", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("header-row-is-names.xlsx"));
    await main.getByRole("radio").first().check();

    await page.locator("#import-column-0").selectOption("pet.name");
    await page.locator("#import-column-1").selectOption("client.firstName");
    await page.locator("#import-column-2").selectOption("client.phone");

    await main
      .getByRole("button", { name: /show what will happen|ne olacağını gösterin/i })
      .click();

    // Three rows, two people: the third row is the first person's second
    // animal, and the phone is what says so.
    await expect(
      main.getByText(/2 clients will be created|2 müşteri oluşturulacak/i),
    ).toBeVisible();
    await expect(
      main.getByText(/3 animals will be created|3 hayvan oluşturulacak/i),
    ).toBeVisible();

    await main.getByRole("button", { name: /^(save|kaydedin)$/i }).click();
    await expect(main.getByText(/^(Imported|İçe aktarıldı)$/)).toBeVisible();

    // Really there, on the screen the vet would open next.
    await page.goto("/clients");
    await expect(page.getByText("Ayşe Yılmaz")).toHaveCount(1);
    await expect(page.getByText("Mehmet Demir")).toHaveCount(1);

    // And gone again, from the list of imports rather than from the result
    // card: that list is the one that is still there at noon.
    await page.goto("/import");
    await page
      .getByRole("button", { name: /undo this import|bu içe aktarmayı geri alın/i })
      .click();
    await expect(
      page.getByText(/were taken back|geri alındı/i).first(),
    ).toBeVisible();

    await page.goto("/clients");
    await expect(page.getByText("Ayşe Yılmaz")).toHaveCount(0);
  });
});
