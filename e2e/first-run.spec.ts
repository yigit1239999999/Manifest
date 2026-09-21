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

  // The `/new` routes above are reached by typing a URL. The screens a vet
  // actually lands on are the lists, and on a first morning three of them
  // offered "New appointment" / "New visit" / "New invoice" — buttons whose
  // form has an empty picker behind it. Each list now names the same link
  // its `/new` route does: the animal for appointments and visits, the
  // client for pets and invoices, because a bill needs no animal.
  //
  // `/clients` is the exception and the point of the whole exercise: it is
  // the one screen on a fresh clinic whose button leads to a form that can
  // be filled in, and it had no button at all.
  const lists = [
    { path: "/pets", says: /a client comes first|önce müşteri gerekir/i, to: "/clients/new" },
    { path: "/invoices", says: /a client comes first|önce müşteri gerekir/i, to: "/clients/new" },
    { path: "/appointments", says: /a pet comes first|önce hayvan gerekir/i, to: "/pets/new" },
    { path: "/visits", says: /a pet comes first|önce hayvan gerekir/i, to: "/pets/new" },
  ];

  test("every empty list names the link that is missing", async ({ page }) => {
    await signUp(page, Date.now());

    for (const list of lists) {
      await page.goto(list.path);
      const main = page.getByRole("main");
      await expect(main.getByText(list.says)).toBeVisible();

      // A screen may offer more than one way forward; they must all go
      // to the same place. On these four there is one place to go, so
      // the count is one.
      //
      // Not a rule against two buttons: /clients deliberately carries
      // the same "New client" in its header and its empty state, and
      // both open the same form. What this catches is the version of
      // this work that shipped for one build, where the header's "New
      // pet" stood beside a body saying an owner had to exist first --
      // two buttons, two destinations, one a dead end. The href alone
      // could not see it, because the href it checked was the right one.
      const ways = main.getByRole("link", { name: /^(new|yeni) /i });
      await expect(ways).toHaveCount(1);
      await expect(ways).toHaveAttribute("href", list.to);
    }

    await page.goto("/clients");
    await expect(
      page
        .getByRole("main")
        .getByRole("link", { name: /new client|yeni müşteri/i })
        .last(),
    ).toHaveAttribute("href", "/clients/new");
  });

  // No `/prescriptions/new` route exists: a prescription is written inside
  // a visit or on an animal's page. A button here would be the same fault
  // the four above were built to remove, so the screen keeps its sentence
  // and offers nothing.
  test("the one list with nowhere to send anybody offers no button", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    await page.goto("/prescriptions");
    const main = page.getByRole("main");
    await expect(main.getByRole("link")).toHaveCount(0);
  });

  // One line at the top, naming one link, and it has to be the one that is
  // actually missing — not a checklist that stays on screen after the work
  // is done. The second half of this test is the half that matters: the
  // card is gone for good the moment the chain is complete.
  test("the dashboard names one missing link, then stops", async ({ page }) => {
    await signUp(page, Date.now());

    const main = page.getByRole("main");
    const firstStep = main.getByRole("link", {
      name: /new client|yeni müşteri|new pet|yeni hayvan/i,
    });

    await expect(firstStep).toHaveAttribute("href", "/clients/new");

    await page.goto("/clients/new");
    await page.getByLabel(/first name|^ad$/i).fill("Devrim");
    await page.getByLabel(/last name|soyad/i).fill("Aksoy");
    await page
      .getByRole("button", { name: /create client|müşteri oluştur/i })
      .click();
    await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);

    // The chain moved on by exactly one link, and no further: no third
    // card about staff, species or notification settings.
    await page.goto("/");
    await expect(firstStep).toHaveAttribute("href", "/pets/new");
  });

  // 390px, because the dashboard's chart card produced 140px of sideways
  // scroll at this width and nobody had looked. The card added above it is
  // a sentence and a button in a row, which is exactly the shape that
  // stops fitting first.
  test("the first-step card fits a phone in both catalogues", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUp(page, Date.now());

    for (const locale of ["tr", "en"]) {
      // The language is a cookie, not a query parameter (`i18n/request.ts`).
      await page.context().addCookies([
        { name: "locale", value: locale, url: new URL(page.url()).origin },
      ]);
      await page.goto("/");
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, `sideways scroll in ${locale}`).toBeLessThanOrEqual(0);
    }
  });

  // The chain walked down and then back up again, which is the half that
  // was missing: before `?next=`, every save landed on the new record's
  // own page and the vet had to remember the errand and navigate back --
  // two manual steps in an eight-screen walk, taken on the day they know
  // the product least.
  test("a record made mid-errand comes back to the form that needed it", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    // Down: the visit needs an animal, the animal needs a client, and
    // each step carries the one below it.
    await page.goto("/visits/new");
    const main = page.getByRole("main");
    await main.getByRole("link", { name: /new pet|yeni hayvan/i }).click();
    await expect(page).toHaveURL("/pets/new?next=%2Fvisits%2Fnew");
    await main.getByRole("link", { name: /new client|yeni müşteri/i }).click();
    await expect(page).toHaveURL(
      "/clients/new?next=" + encodeURIComponent("/pets/new?next=%2Fvisits%2Fnew"),
    );

    // Up, one link: back on the animal form with the owner already in it.
    await page.getByLabel(/first name|^ad$/i).fill("Devrim");
    await page.getByLabel(/last name|soyad/i).fill("Aksoy");
    await page
      .getByRole("button", { name: /create client|müşteri oluştur/i })
      .click();
    await expect(page).toHaveURL(/\/pets\/new\?.*ownerId=/);
    await expect(page.getByLabel(/^owner$|^sahibi$/i)).toHaveValue(
      "Devrim Aksoy",
    );

    // Up, the last link: back on the visit form with the animal in it,
    // named the way every other picker names one.
    await page.getByLabel(/^name$|^isim$/i).fill("Zeytin");
    await page.getByRole("button", { name: /^cat$|^kedi$/i }).click();
    await page.getByLabel(/^sex$|^cinsiyet$/i).selectOption("FEMALE");
    await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();
    await expect(page).toHaveURL(/\/visits\/new\?.*petId=/);
    await expect(page.getByLabel(/^pet$|^hayvan$/i)).toHaveValue(
      "Zeytin · Devrim Aksoy",
    );
  });

  // The same errand from the one screen that asks for a client rather
  // than an animal -- and the one that calls it something else. A bill
  // reads `clientId` where the animal form reads `ownerId`, so handing
  // both back under one name left this picker empty: the defect the
  // errand exists to close, moved one screen along.
  test("a bill gets the client back under the name it reads", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    await page.goto("/invoices/new");
    await page
      .getByRole("main")
      .getByRole("link", { name: /new client|yeni müşteri/i })
      .click();
    await expect(page).toHaveURL("/clients/new?next=%2Finvoices%2Fnew");

    await page.getByLabel(/first name|^ad$/i).fill("Selin");
    await page.getByLabel(/last name|soyad/i).fill("Kaya");
    await page
      .getByRole("button", { name: /create client|müşteri oluştur/i })
      .click();

    await expect(page).toHaveURL(/\/invoices\/new\?.*clientId=/);
    await expect(page.getByLabel(/^client$|^müşteri$/i)).toHaveValue(
      "Selin Kaya",
    );
  });
});
