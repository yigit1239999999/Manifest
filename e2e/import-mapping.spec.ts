import path from "node:path";
import { test, expect, assertFormKept } from "./helpers";
import { writeFixtures } from "./import-fixtures";

/**
 * The import screen, walked with real files.
 *
 * The files are built here rather than kept in the repository: each is
 * named after the mechanism it exercises (`e2e/import-fixtures.ts`).
 *
 * What only a browser can check: the file is read IN the page now, so the
 * workbook and CSV readers run where the vet's file is, and the rows cross
 * to the server compressed. A unit test mocks exactly that away.
 *
 * Field pickers are driven by id and by field VALUE ("client.phone"), not
 * by their words: the value is the same in both catalogues, and a locator
 * written in words would be a leg nobody runs (`e2e/locator-legs.test.ts`).
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
  await assertFormKept(page);
  await page.getByRole("button", { name: /create account|hesap oluştur/i }).click();
  await expect(page).toHaveURL("/");
}

async function openImport(page: import("@playwright/test").Page) {
  await signUp(page, Date.now());
  await page.goto("/import");
  return page.getByRole("main");
}

const CONTINUE = /^(continue|devam et)$/i;
const IMPORT = /^(import \d+ animals?|\d+ hayvanı aktarın)$/i;
const IMPORTED = /^(Imported|Aktarıldı)$/;

/** The matched columns are folded away; open them to change one. */
async function openMatched(main: import("@playwright/test").Locator) {
  await main.getByText(/columns? matched|sütun eşleşti/i).click();
}

test.describe("Importing a spreadsheet", () => {
  test("matches a file whose headings say what they are, by itself", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("header-row-is-names.xlsx"));

    await expect(
      main.getByText(/we matched all 4 columns|4 sütunun hepsini eşleştirdik/i),
    ).toBeVisible();
    await expect(page.locator("#import-column-0")).toHaveValue("pet.name");
    await expect(page.locator("#import-column-1")).toHaveValue("client.firstName");
    await expect(page.locator("#import-column-2")).toHaveValue("client.phone");
    // Their own values, with the spaces they typed -- never masked ones.
    await expect(main.getByText(/0532 111 22 33/).first()).toBeAttached();
    await expect(main.getByText(/Xxxx/)).toHaveCount(0);
  });

  test("asks about the first row only when nothing in the file can tell", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("first-row-is-a-record.xlsx"));
    await expect(
      // Capital dotted I, deliberately: JS `/i` does not fold `İ` onto `i`.
      main.getByText(/is the first row column names|İlk satır sütun adları mı/i),
    ).toBeVisible();
    for (const radio of await main.getByRole("radio").all()) {
      await expect(radio).not.toBeChecked();
    }
  });

  test("asks once which way the dates read, and does not guess", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("date-shaped-text-ambiguous.xlsx"));
    await expect(main.getByText(/is the day first|gün mü önce/i)).toBeVisible();
    await expect(main.getByRole("radio", { name: /^(day first|önce gün)/i })).not.toBeChecked();
    await expect(main.getByRole("radio", { name: /^(month first|önce ay)/i })).not.toBeChecked();

    // Continuing without an answer is refused, and says why.
    await main.getByRole("button", { name: CONTINUE }).click();
    await expect(
      main.getByText(/choose how the dates should be read|tarihlerin nasıl okunacağını seçin/i),
    ).toBeVisible();
  });

  test("asks which sheet only when there is more than one", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("two-sheets.xlsx"));
    await expect(main.getByText(/which sheet should we import|hangi sayfayı aktaralım/i)).toBeVisible();

    await main.locator('input[type="file"]').setInputFiles(file("header-row-is-names.xlsx"));
    await expect(main.getByText(/which sheet should we import|hangi sayfayı aktaralım/i)).toHaveCount(0);
  });

  test("says so, and puts focus on it, when a file cannot be read", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("not-a-spreadsheet.xlsx"));
    const sentence = main.getByText(/we could not read this file|bu dosyayı okuyamadık/i);
    await expect(sentence).toBeVisible();
    await expect(page.locator(":focus")).toContainText(/we could not read this file|bu dosyayı okuyamadık/i);
  });

  test("reads a Windows-1254 semicolon CSV the way Turkish Excel saves it", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("turkish-excel.csv"));
    await expect(main.getByText(/Ayşe Şahin/).first()).toBeAttached();
    await expect(page.locator("#import-column-4")).toHaveValue("vaccine.column");
    await expect(page.locator("#import-vaccine-4")).toHaveValue("Kuduz");
  });

  test("brings in both vaccine columns of a row as two records", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("vaccine-columns.xlsx"));
    await expect(page.locator("#import-vaccine-4")).toHaveValue("Kuduz");
    await expect(page.locator("#import-vaccine-5")).toHaveValue("Karma");

    // Leaving a column of vaccination dates out is said out loud, and
    // "all matched" stops being said.
    await openMatched(main);
    await page.locator("#import-column-5").selectOption("skip");
    await expect(
      main.getByText(/has vaccination dates in it|içinde aşı tarihi var/i),
    ).toBeVisible();
    await expect(main.getByText(/we matched all|hepsini eşleştirdik/i)).toHaveCount(0);
    await page.locator("#import-column-5").selectOption("vaccine.column");

    await main.getByRole("button", { name: CONTINUE }).click();
    await expect(main.getByText(/^(3 vaccinations|3 aşı kaydı)$/).first()).toBeVisible();
    await main.getByRole("button", { name: IMPORT }).click();
    await expect(main.getByText(IMPORTED)).toBeVisible();
    // The plural lives inside an ICU branch, so the count is read off the
    // sentence rather than written into the locator.
    await expect(main.getByText(/came in\.$|geldi\.$/)).toContainText("3");

    // On the animal's record, as a day with no time of day invented.
    await page.goto("/pets");
    await page.getByRole("link", { name: "Pamuk" }).first().click();
    await expect(page.getByText(/^(Kuduz)$/).first()).toBeVisible();
    await expect(page.getByText(/^(Karma)$/).first()).toBeVisible();
  });

  test("reads the same file a second time as nothing new", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("vaccine-columns.xlsx"));
    await main.getByRole("button", { name: CONTINUE }).click();
    await main.getByRole("button", { name: IMPORT }).click();
    await expect(main.getByText(IMPORTED)).toBeVisible();

    await page.goto("/import");
    const again = page.getByRole("main");
    await again.locator('input[type="file"]').setInputFiles(file("vaccine-columns.xlsx"));
    await again.getByRole("button", { name: CONTINUE }).click();
    await expect(
      again.getByText(/2 animals in this file are already in your clinic|bu dosyadaki 2 hayvan zaten kliniğinizde/i),
    ).toBeVisible();
    await expect(again.getByText(/nothing new in this file|eklenecek yeni bir şey yok/i)).toBeVisible();
  });

  test("lets the vet say what the file did not, when there is no species column", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("header-row-is-names.xlsx"));
    await main.getByRole("button", { name: CONTINUE }).click();

    const picker = page.locator("#species-fallback");
    await expect(picker).toBeVisible();
    await expect(picker).toHaveValue("");
    await expect(main.getByText(/have no species|tür bilgisi yok/i)).toBeVisible();

    await picker.selectOption("builtIn:CAT");
    await expect(main.getByText(/will be recorded as|olarak kaydedilecek/i)).toBeVisible();

    await main.getByRole("button", { name: IMPORT }).click();
    await expect(main.getByText(IMPORTED)).toBeVisible();
    await page.goto("/pets");
    // "Cat · 7 yr": the birth dates came too, since the heading named them.
    await expect(page.getByText(/^(Cat|Kedi)\b/)).toHaveCount(3);
  });

  test("writes the rows, and takes them back", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("header-row-is-names.xlsx"));
    await main.getByRole("button", { name: CONTINUE }).click();

    // Three rows, two people: the third row is the first person's second
    // animal, and the phone is what says so.
    await expect(main.getByText(/^(2 new owners|2 yeni sahip)$/).first()).toBeVisible();
    await expect(main.getByRole("button", { name: IMPORT })).toHaveText(/3/);

    await main.getByRole("button", { name: IMPORT }).click();
    await expect(main.getByText(IMPORTED)).toBeVisible();

    await page.goto("/clients");
    await expect(page.getByText("Ayşe Yılmaz")).toHaveCount(1);
    await expect(page.getByText("Mehmet Demir")).toHaveCount(1);

    await page.goto("/import");
    await page.getByRole("button", { name: /undo this import|bu aktarımı geri alın/i }).click();
    await expect(page.getByText(/were taken back|geri alındı/i).first()).toBeVisible();
    await page.goto("/clients");
    await expect(page.getByText("Ayşe Yılmaz")).toHaveCount(0);
  });

  test("will not merge a name it cannot confirm, and says so when asked to import", async ({ page }) => {
    const main = await openImport(page);
    await main.locator('input[type="file"]').setInputFiles(file("header-row-is-names.xlsx"));
    await main.getByRole("button", { name: CONTINUE }).click();
    await main.getByRole("button", { name: IMPORT }).click();
    await expect(main.getByText(IMPORTED)).toBeVisible();

    // A second file with the same name, no number, and an animal the clinic
    // has not seen: nothing confirms it is her. (The same file without its
    // phone column no longer asks -- "Ayşe Yılmaz with Boncuk" is
    // recognised by the animal she already has.)
    await page.goto("/import");
    const second = page.getByRole("main");
    await second.locator('input[type="file"]').setInputFiles(file("same-name-new-animal.xlsx"));
    await second.getByRole("button", { name: CONTINUE }).click();
    await expect(second.getByText(/^(the same person\?|aynı kişi mi\?)$/i)).toBeVisible();
    await expect(second.getByRole("cell", { name: /^(waiting for you|kararınızı bekliyor)$/i })).toBeAttached();

    await second.getByRole("button", { name: /^(import|aktarın)|aktarın$/i }).click();
    await expect(
      second.getByText(/answer the "the same person\?" questions first|önce "aynı kişi mi\?" sorularını yanıtlayın/i),
    ).toBeVisible();
    await page.goto("/clients");
    await expect(page.getByText("Ayşe Yılmaz")).toHaveCount(1);
  });
});
