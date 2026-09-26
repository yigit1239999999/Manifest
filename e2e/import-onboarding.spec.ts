import path from "node:path";
import { test, expect, assertFormKept } from "./helpers";
import { writeFixtures } from "./import-fixtures";

/**
 * The whole way in: a clinic's first morning, a spreadsheet, and taking it
 * back -- in both catalogues.
 *
 * WHY THIS IS A SEPARATE JOURNEY FROM `import-mapping.spec.ts`. That file
 * walks the import SCREEN and starts by going to `/import`. This one starts
 * where the vet starts, which is the dashboard of an empty clinic, and the
 * thing it is really testing is the DOOR: `/import` did the job for weeks
 * while nothing on the first morning pointed at it, and a screen nobody can
 * reach is a screen that does not exist.
 *
 * TR AND EN, BOTH, AND NOT AS CEREMONY. A leg of this product has died in
 * one language while the suite stayed green (`e2e/locator-legs.test.ts`
 * exists because of it), and this path crosses four screens' worth of
 * message keys -- the invitation, the mapping questions, the save, the
 * undo. A run in one language proves one of those catalogues.
 *
 * THE ANIMALS ARE ASSERTED BY NAME, and that is the assertion this file was
 * asked for rather than a flourish. The existing commit test counts two
 * people on `/clients` and says nothing about any animal, so an import that
 * wrote every client and dropped every pet would pass it. That is not
 * hypothetical: `modules/import/service.ts` builds its client key around a
 * separator that is a bare NUL byte, and normalising that byte makes the
 * pet loop `continue` past every newly created client's animals -- silently,
 * with the client count still right. Naming the animals here is what makes
 * that change visible from outside.
 */
const dir = path.join(process.cwd(), "tmp/import-fixtures");
const file = (name: string) => path.join(dir, name);

/** The fixture's three animals, and the two people they belong to. */
const ANIMALS = ["Boncuk", "Pamuk", "Zeytin"];

test.beforeAll(async () => {
  await writeFixtures(dir);
});

for (const locale of ["tr", "en"] as const) {
  test(`a spreadsheet arrives on the first morning and can be taken back (${locale})`, async ({
    page,
  }) => {
    // The language is a cookie, not a query parameter (`i18n/request.ts`),
    // and it is set before the first authenticated screen so that every
    // sentence on the way -- including the invitation -- is this catalogue.
    await page.goto("/sign-in");
    await page.context().addCookies([
      { name: "locale", value: locale, url: new URL(page.url()).origin },
    ]);

    const stamp = Date.now();
    await page.goto("/sign-up");
    await page.getByLabel(/clinic name|klinik adı/i).fill(`Clinic ${stamp}`);
    await page.getByLabel(/your name|adın/i).fill("E2E Tester");
    await page.getByLabel(/^e-?mail$|^e-posta$/i).fill(`e2e+import${stamp}@pettrack.test`);
    await page.getByLabel(/^password|^şifre/i).fill("supersecret123");
    await assertFormKept(page);
    await page.getByRole("button", { name: /create account|hesap oluştur/i }).click();
    await expect(page).toHaveURL("/");

    // THE DOOR. Found by what it says rather than by its href: the href is
    // asserted one file over (`first-run.spec.ts`), and what this journey
    // needs to know is that a vet reading the screen in their own language
    // is offered the way in. Clicked, not read.
    await page
      .getByRole("link", { name: /spreadsheet|Excel/i })
      .click();
    await expect(page).toHaveURL("/import");

    const main = page.getByRole("main");
    await main.locator('input[type="file"]').setInputFiles(file("header-row-is-names.xlsx"));
    await main.getByRole("radio").first().check();

    await page.locator("#import-column-0").selectOption("pet.name");
    await page.locator("#import-column-1").selectOption("client.firstName");
    await page.locator("#import-column-2").selectOption("client.phone");
    await page.locator("#import-column-3").selectOption("pet.birthDate");

    // 390px, with the column cards on screen -- the widest this path ever
    // gets, since every column of the file becomes a card. `/import` is not
    // in `touch-targets.spec.ts`'s sweep and putting it there would make it
    // red for reasons outside this task (dev-ui), so the geometry is
    // asserted on the journey that is already standing here.
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow, `sideways scroll on /import at 390px in ${locale}`).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 1280, height: 800 });

    await main
      .getByRole("button", { name: /show what will happen|ne olacağını gösterin/i })
      .click();
    await expect(
      main.getByText(/2 clients will be created|2 müşteri oluşturulacak/i),
    ).toBeVisible();

    await main.getByRole("button", { name: /^(save|kaydedin)$/i }).click();
    await expect(main.getByText(/^(Imported|İçe aktarıldı)$/)).toBeVisible();

    // The animals, by name, on the screen the vet opens next.
    await page.goto("/pets");
    for (const name of ANIMALS) {
      await expect(page.getByText(name, { exact: true })).toHaveCount(1);
    }

    // And taken back, from the list of past imports rather than from the
    // result card: that list is the one still there after the page is left.
    await page.goto("/import");
    await page
      .getByRole("button", { name: /undo this import|bu içe aktarmayı geri alın/i })
      .click();
    await expect(page.getByText(/were taken back|geri alındı/i).first()).toBeVisible();

    await page.goto("/pets");
    for (const name of ANIMALS) {
      await expect(page.getByText(name, { exact: true })).toHaveCount(0);
    }
  });
}
