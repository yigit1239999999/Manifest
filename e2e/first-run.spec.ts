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
      //
      // The whole address, `next` included, because which route the
      // button comes back to is the half worth measuring: a link that
      // goes to `/clients/new` and forgets where it came from still
      // leaves the vet to find their way back, which is the defect the
      // errand exists to remove. Matching a prefix would pass either
      // way and tell us nothing.
      await expect(main.getByRole("link").last()).toHaveAttribute(
        "href",
        `${guard.to}?next=${encodeURIComponent(guard.path)}`,
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
      // The whole address, errand included: which list the button comes
      // back to is the half worth measuring, and a vet sent from
      // /appointments belongs back on /appointments rather than on the
      // new record's own page. Matching a prefix would pass either way.
      await expect(ways).toHaveAttribute(
        "href",
        `${list.to}?next=${encodeURIComponent(list.path)}`,
      );
    }

    await page.goto("/clients");
    await expect(
      page
        .getByRole("main")
        .getByRole("link", { name: /new client|yeni müşteri/i })
        .last(),
    ).toHaveAttribute("href", "/clients/new");
  });

  // The fifth screen, and the one that hid behind a different shape.
  // /reminders has no /new route: it puts the form on the page, inside a
  // card, so the sweep that walked the four /new routes never reached it
  // and the sweep that walked the empty lists saw a screen that was not
  // empty. A reminder needs a client, so on a fresh clinic the required
  // picker answered "no results" and the screen offered nowhere to go --
  // the pattern the other four closed this morning, still open (pm).
  test("the screen that shows its form inline is guarded too", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    await page.goto("/reminders");
    const main = page.getByRole("main");
    await expect(
      main.getByText(/a client comes first|önce müşteri gerekir/i),
    ).toBeVisible();
    // The form is gone rather than disabled: a picker that opens on
    // nothing is the thing being removed, not decorated.
    await expect(main.getByRole("combobox")).toHaveCount(0);
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

  // One line at the top, asking for one thing, and it has to be the right
  // thing for the clinic reading it — not a checklist that stays on screen
  // after the work is done.
  //
  // A clinic with nothing at all is asked for the work rather than for a
  // record: the vet said they sit down to see a patient, not to do data
  // entry, and the chain makes the owner and the animal on the way there.
  // A clinic that is part-way has already answered that question, so it is
  // asked for the link it is actually missing. Both are one line and one
  // button; what changes is which.
  test("the dashboard asks for the work, then for what is missing", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    const main = page.getByRole("main");
    const firstStep = main.getByRole("link", {
      name: /^(new|yeni) /i,
    });

    await expect(firstStep).toHaveAttribute("href", "/visits/new");

    await page.goto("/clients/new");
    await page.getByLabel(/first name|^ad$/i).fill("Devrim");
    await page.getByLabel(/last name|soyad/i).fill("Aksoy");
    await page
      .getByRole("button", { name: /create client|müşteri oluştur/i })
      .click();
    await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);

    // One client in, and the ask moves to the animal -- one line still,
    // and no second card appearing beside it about staff, species or
    // notification settings. That bound is the design: a card that can
    // name a third thing is a setup checklist.
    await page.goto("/");
    await expect(firstStep).toHaveCount(1);
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

  // The other kind of errand, and the difference is not cosmetic. The two
  // cases above start on a form: the vet had begun the work, so they are
  // handed back to it with the new record already in the field. This one
  // starts on a list, where they had begun nothing -- they were reading
  // -- and the right ending is the list they were reading, now with the
  // thing that was missing on it. Handing them /appointments/new instead
  // would assume they meant to book something, which is the assumption
  // this whole piece of work exists to stop making.
  test("an errand begun on a list ends on that list, not on a form", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    await page.goto("/appointments");
    const main = page.getByRole("main");
    await main.getByRole("link", { name: /new pet|yeni hayvan/i }).click();
    await expect(page).toHaveURL("/pets/new?next=%2Fappointments");

    // Two links deep from a list, so the list has to survive being
    // nested inside another errand and not just being the first one.
    await main.getByRole("link", { name: /new client|yeni müşteri/i }).click();
    await page.getByLabel(/first name|^ad$/i).fill("Kerem");
    await page.getByLabel(/last name|soyad/i).fill("Doğan");
    await page
      .getByRole("button", { name: /create client|müşteri oluştur/i })
      .click();
    await expect(page).toHaveURL(/\/pets\/new\?.*ownerId=/);

    await page.getByLabel(/^name$|^isim$/i).fill("Pamuk");
    await page.getByRole("button", { name: /^cat$|^kedi$/i }).click();
    await page.getByLabel(/^sex$|^cinsiyet$/i).selectOption("FEMALE");
    await page.getByRole("button", { name: /create pet|hayvan ekle/i }).click();

    // The list, with no id appended: a list has no slot to put one in.
    await expect(page).toHaveURL("/appointments");

    // And the reason they were sent away in the first place is gone, so
    // the screen they come back to is not the screen they left.
    await expect(
      main.getByText(/a pet comes first|önce hayvan gerekir/i),
    ).toHaveCount(0);

    // The list is still empty -- an animal is not an appointment -- so
    // the screen is back to its ordinary empty state, with the header's
    // button and the empty state's own. Two ways forward, which is
    // allowed; what is not allowed is their disagreeing about where
    // they go, so both are checked rather than counted.
    const onward = main.getByRole("link", {
      name: /new appointment|yeni randevu/i,
    });
    await expect(onward).toHaveCount(2);
    for (const link of await onward.all()) {
      await expect(link).toHaveAttribute("href", "/appointments/new");
    }
  });
});
