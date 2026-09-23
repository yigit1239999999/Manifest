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
  { path: "/invoices/new", says: /a client comes first|önce müşteri gerekir/i, to: "/clients/new" },
  { path: "/appointments/new", says: /a pet comes first|önce hayvan gerekir/i, to: "/pets/new" },
];

// `/visits/new` and `/pets/new` are deliberately NOT in that list any
// more, and the difference is the vet's rule rather than an exception:
// a precondition is said INSIDE the form when the form can satisfy it.
// Those two screens now offer to make the missing record from whatever
// is typed into their picker, so there is no dead end for a door to
// stand in front of. The two above have no such box -- somebody who
// walked in from the side really can go no further -- so their doors
// are right and stay.
// What a clinic with nothing on file meets, in the order it meets it.
// `asks` is the empty box: "search or type" is written for a clinic
// that has records, and the vet who opened the first one read it as a
// search they could not win. `says` is the list, opened by focus alone,
// which used to answer "no results" to a search nobody had run.
//
// `says` is asserted whole rather than by a fragment, and that is the
// point of it: the sentence has to name what is missing AND what to do.
// ui measured that the line under the label is covered by the list the
// instant it opens (`combobox.tsx:579`), so a body that only reports a
// state leaves the vet with no next move.
const doorless = [
  {
    path: "/visits/new",
    field: /^pet$|^hayvan$/i,
    typed: "Limon",
    asks: /Type the animal's name|Hayvanın adını yazın/i,
    says: /No animals on file in this clinic yet; you can open a new one from what you type on this form\.|Bu klinikte henüz hayvan kaydı yok; yazdığınız adla yenisini aynı formda açabilirsiniz\./i,
  },
  {
    // The one picker that does change the address, so it promises a
    // form rather than this form.
    path: "/pets/new",
    field: /^owner$|^sahibi$/i,
    typed: "Ayşe Çelik",
    asks: /Type the owner's name|Sahibinin adını yazın/i,
    says: /No clients on file in this clinic yet; the name you type opens in the client form\.|Bu klinikte henüz müşteri kaydı yok; yazdığınız adla yenisi müşteri formunda açılır\./i,
  },
];

test.describe("First run", () => {
  // "The dog is on the table, the owner is crying, and what I got was
  // not a blank page but a door." The card that sends an empty clinic to
  // /visits/new promises the animal and the owner can be made on the
  // way; two doors stood in front of that promise, and the box for the
  // animal's name was on the third screen.
  test("the screens the card promises open as forms, not as doors", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    for (const screen of doorless) {
      await page.goto(screen.path);
      const main = page.getByRole("main");
      const box = main.getByRole("combobox", { name: screen.field });
      await expect(box).toBeVisible();
      await expect(
        main.getByText(/comes first|önce .* gerekir/i),
      ).toHaveCount(0);

      // Before a key is pressed: the box asks for a name rather than
      // offering a search.
      await expect(box).toHaveAttribute("placeholder", screen.asks);

      // Under the label, before focus, where it is the only copy.
      await expect(main.getByText(screen.says)).toBeVisible();

      // And again inside the list, opened by focus alone. Two nodes
      // carrying one string is the design rather than a duplicate: the
      // list covers the line under the label as it opens, so each has
      // to be whole on its own. Scoped to the listbox for that reason
      // -- an unscoped match is two elements and strict mode is right
      // to say so.
      await box.focus();
      const list = main.getByRole("listbox");
      await expect(list.getByText(screen.says)).toBeVisible();
      await expect(main.getByText(/no results|sonuç yok/i)).toHaveCount(0);

      // The way out is inside the field: typed text is searched first,
      // and the offer to create it sits under whatever was found.
      await box.fill(screen.typed);
      await expect(
        main.getByRole("option", { name: new RegExp(screen.typed) }).last(),
      ).toBeVisible();
    }
  });

  test("every /new route that cannot help names the record that is missing", async ({
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
  // form has an empty picker behind it. Each list still names the link its
  // `/new` route does: the animal for appointments, the client for
  // invoices, because a bill needs no animal.
  //
  // `/clients` is the exception and the point of the whole exercise: it is
  // the one screen on a fresh clinic whose button leads to a form that can
  // be filled in, and it had no button at all.
  //
  // `/pets` and `/visits` LEFT this list, and the two that stay are
  // deliberate rather than unfinished. A visit is now recordable on a
  // fresh clinic -- the animal and its owner are opened inside the visit
  // form -- and so is an animal, whose owner box does the same. An
  // appointment is a different thing: it is tomorrow's, and the animal
  // it is for exists before it is booked. Routing every empty list to
  // `/visits/new` would say that a clinic's first act is always an
  // examination, which is true of the morning and false of the diary.
  const lists = [
    { path: "/invoices", says: /a client comes first|önce müşteri gerekir/i, to: "/clients/new" },
    { path: "/appointments", says: /a pet comes first|önce hayvan gerekir/i, to: "/pets/new" },
  ];

  // The two screens whose doors came down, and what stands there now.
  //
  // A vet on their first morning has an animal on the table, not a
  // records problem, and what they got here was a screen naming a
  // record they have to go and make first. The form behind each of
  // these buttons can now be filled in from empty: the visit opens its
  // animal and that animal's owner, and the animal form opens its
  // owner. So the empty state is the ordinary one -- "no visits yet",
  // and the way to make one.
  const opened = [
    { path: "/pets", to: "/pets/new" },
    { path: "/visits", to: "/visits/new" },
  ];

  test("the two lists a first morning starts from open their own form", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    for (const list of opened) {
      await page.goto(list.path);
      const main = page.getByRole("main");

      // Nothing about a record that has to exist first: the sentence
      // this whole round is about is gone from both.
      await expect(
        main.getByText(
          /comes first|önce müşteri gerekir|önce hayvan gerekir/i,
        ),
      ).toHaveCount(0);

      // Both ways forward -- the header's and the empty state's -- and
      // they go to the same form, which is what makes two of them fine
      // (`/clients` has always carried two).
      const ways = main.getByRole("link", { name: /^(new|yeni) /i });
      await expect(ways).toHaveCount(2);
      for (const way of await ways.all()) {
        await expect(way).toHaveAttribute("href", list.to);
      }
    }
  });

  test("every empty list names the link that is missing", async ({ page }) => {
    await signUp(page, Date.now());

    for (const list of lists) {
      await page.goto(list.path);
      const main = page.getByRole("main");
      await expect(main.getByText(list.says)).toBeVisible();

      // A screen may offer more than one way forward; they must all go
      // to the same place. On these two there is one place to go, so
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

    // The errand, checked rather than deduced. This screen's entry in
    // ALLOWED_PATHS arrived separately from the `next` it enables, and
    // `safeNext` drops an unlisted destination SILENTLY -- so a binding
    // made against a build without the entry renders a button that
    // works, goes to the right form, and quietly forgets where it came
    // from. Nothing about that looks broken, which is exactly why it
    // needs an assertion rather than a reading of the whitelist.
    await expect(
      main.getByRole("link", { name: /new client|yeni müşteri/i }),
    ).toHaveAttribute("href", "/clients/new?next=%2Freminders");
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
    // The ask, found by what it SAYS rather than by what it is made of.
    //
    // This read `getByRole("link")` and asserted an `href`, which is the
    // fault K6 was rewritten for, one test down: the name promises a
    // behaviour -- the dashboard asks for the work -- and the assertion
    // checked markup. The two fail in opposite directions and the second
    // is the nastier one. A silent guard lets a regression through; this
    // one turns red at somebody who has broken nothing, and they either
    // "fix" the test or abandon a legitimate change (dev).
    //
    // So: click it and see where it goes. A link passes, and so does the
    // submitting form the inline-field direction would make it.
    //
    // The set is the one pm's acceptance tool counts, so the two cannot
    // disagree about what "one ask" means.
    const asks = main.locator(
      'a[href], button[type="submit"], button:not([type])',
    );

    // No filter here, and that is the stronger form: on this screen the
    // set has exactly one member, so naming the ask would be picking it
    // out of a crowd that does not exist -- and every way of naming it
    // (role, text, href) is a dependency this line does not need.
    //
    // And no count either. CARDINALITY BELONGS TO THE TEST BELOW, which
    // is named for it; this one is named for where the ask leads, and
    // that is all it checks. The two assertions were briefly the same
    // line in both tests, which meant a second call to action produced
    // two reds -- one naming the rule it broke, one naming something it
    // had not touched, sending the reader to look at a destination when
    // what had changed was a number (dev). A guard whose NAME points at
    // the wrong thing is the same fault this file was just cleaned of,
    // wearing different clothes.
    //
    // `first()` rather than a count, so a crowded screen cannot make
    // this fail as a strict-mode error about the tooling. If the wrong
    // element is ever first, the URL assertion below is what says so.
    await asks.first().click();
    await expect(page).toHaveURL(/\/visits\/new(\?|$)/);

    await page.goto("/clients/new");
    await page.getByLabel(/first name|^ad$/i).fill("Devrim");
    await page.getByLabel(/last name|soyad/i).fill("Aksoy");
    // Required since the counter's two fields swapped places: the
    // surname is politeness, the number is the only handle the clinic
    // keeps on the animal afterwards.
    await page.getByLabel(/phone|telefon/i).first().fill("0532 111 22 33");
    await page
      .getByRole("button", { name: /create client|müşteri oluştur/i })
      .click();
    await expect(page).toHaveURL(/\/clients\/(?!new)[\w-]+$/);

    // One client in, and the ask moves to the animal -- one line still,
    // and no second card appearing beside it about staff, species or
    // notification settings. That bound is the design: a card that can
    // name a third thing is a setup checklist.
    await page.goto("/");

    // Here the screen IS a crowd -- seven counter tiles, two charts and
    // four lists, all of them links -- so the ask has to be named, and
    // the only honest way to name it is by what the reader sees.
    //
    // WHICH MAKES THIS LINE DEPEND ON COPY, and the dependency is
    // written down rather than discovered later. It reads the labels
    // behind `visit.new` / `pet.new` / `client.new` ("Yeni vizit",
    // "New visit"). Reword those and this locator finds nothing and
    // goes red at somebody who broke nothing -- the same shape as the
    // `href` assertion this test just stopped making, one axis over
    // (team-lead, after pm hit it twice on `#21`: a locator that trusts
    // a label is bound to the product's wording, and this repo rewords
    // often).
    //
    // Kept anyway, and not swapped for a `data-testid`: the e2e suite
    // finds things the way a reader does in 297 places and uses no test
    // id in product markup anywhere. That is not an accident to work
    // around -- a locator that breaks when the accessible name breaks
    // is catching a real defect. Introducing the first product test id
    // inside a test fix would set that policy sideways, which is a
    // decision for a task of its own.
    // Sharp edge, named because it is one keystroke away: a counter tile
    // reading "Yeni müşteri" would join this set and the filter would
    // quietly match two. Nothing does today -- the tiles read "Müşteri",
    // "Hayvan", "Yaklaşan" -- and `toHaveCount(1)` below is what would
    // notice if that changed (dev).
    const ask = asks.filter({ hasText: /^(new|yeni) /i });
    await expect(ask).toHaveCount(1);
    await ask.click();
    await expect(page).toHaveURL(/\/pets\/new(\?|$)/);
  });

  // The bound the test above was assumed to be holding and was not.
  //
  // It reads the card's own link by name and asserts where it goes, so
  // a second call to action landing beside it -- "set up reminders",
  // "invite your staff", a tour -- passes untouched. The thing the
  // design actually promises is that a clinic with nothing in it is
  // asked for exactly one thing, and that is a count, not an href (ux).
  //
  // Counted inside `main`, so the eleven sidebar entries and the topbar
  // are out of scope: the question is what the CONTENT area asks for.
  test("an empty clinic is asked for exactly one thing", async ({ page }) => {
    await signUp(page, Date.now());
    await page.goto("/");

    // The same set pm's acceptance tool counts, and that equality is
    // the point of this line rather than a detail of it. Counting links
    // and requiring zero buttons says the ask must be a LINK, which is
    // a claim about markup and not about the design.
    //
    // The day the card's ask becomes a submit button -- the inline-field
    // direction is parked, not dropped -- the old pair breaks the LOUD
    // way, not the silent one: links reads 0 against `toHaveCount(1)`
    // and buttons reads 1 against `toHaveCount(0)`, so both assertions
    // fail at a change that keeps the rule perfectly. That is the same
    // fault as the `href` assertion one test up, and it was worth
    // getting right: this was written up the other way round -- "stays
    // green while pm's tool reads one" -- and the wrong half is the one
    // a reader would have trusted (team-lead).
    //
    // Counting the set pm counts is still what fixes it, for the reason
    // that survives: whichever markup the ask is made of, both tools
    // read the same number, so they cannot disagree about the rule.
    const main = page.getByRole("main");
    const asks = main.locator(
      'a[href], button[type="submit"], button:not([type])',
    );
    await expect(asks).toHaveCount(1);
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

  // The chain, walked the way it is now: not walked at all.
  //
  // This test used to measure the walk down and back up -- /visits/new
  // to /pets/new to /clients/new and home again, with `?next=` and the
  // typed name carried at every step. Nothing was lost on that walk and
  // it is still the right behaviour for the two forms that HAVE such a
  // chain. What it cost was the thing the vet described: the address
  // changed twice while an examination sat half typed, on the day they
  // know the product least.
  //
  // So the visit does not leave any more, and this is the same journey
  // with the walking taken out: one screen, one save, three records.
  test("a first morning is recorded without the screen ever changing", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    await page.goto("/visits/new");
    const main = page.getByRole("main");

    // The animal that is not on file, asked for from the box that
    // wanted it.
    await main.getByRole("combobox", { name: /^pet$|^hayvan$/i }).fill("Limon");
    await main.getByRole("option", { name: /Limon/ }).last().click();
    // The whole point, asserted first: the vet is still on the form
    // they were filling in.
    await expect(page).toHaveURL("/visits/new");
    await expect(page.getByLabel(/^name$|^isim$/i)).toHaveValue("Limon");

    await page.getByRole("button", { name: /^cat$|^kedi$/i }).click();

    // And its owner, from the box inside that block.
    await main
      .getByRole("combobox", { name: /^owner$|^sahibi$/i })
      .fill("Ayşe Çelik");
    await main.getByRole("option", { name: /Ayşe Çelik/ }).last().click();
    await expect(page).toHaveURL("/visits/new");
    await expect(page.getByLabel(/first name|^ad$/i)).toHaveValue("Ayşe");
    await expect(page.getByLabel(/last name|soyad/i)).toHaveValue("Çelik");

    // No number, and said out loud rather than left blank: the animal
    // is on the table and the counter has not asked yet.
    // By role, because the consent question two lines down offers a
    // "Not now" of its own: they are different answers to different
    // questions and the block says both.
    await page
      .getByRole("checkbox", { name: /no number|şimdi yok/i })
      .check();

    // One save for all three.
    await page.getByRole("button", { name: /create visit|viziti kaydet/i }).click();
    // Not `[^/]+`: that matches `/visits/new`, which is where a
    // refused save leaves the vet standing.
    await expect(page).toHaveURL(/\/visits\/(?!new)[^/?]+(\?|$)/);
    await expect(main).toContainText("Limon");
    await expect(main).toContainText("Ayşe");

    // The one fact the page cannot say by itself -- that these two were
    // born here -- said once, with what to do about the missing number
    // and, on a clinic's first animal, where to look for it tomorrow.
    // Two nodes match on purpose and the count is the assertion: the
    // box somebody reads and the live region a screen reader hears,
    // handed the same string rather than each given its own wording.
    const receipt = main.getByText(
      /were created with this visit|birlikte .* açıldı/,
    );
    await expect(receipt).toHaveCount(2);
    await expect(receipt.first()).toBeVisible();
    await expect(main).toContainText(
      /add their phone number later|Telefon numarasını sonra ekleyebilirsiniz/,
    );
    await expect(main).toContainText(
      /search for the name on the Pets page|Hayvanlar sayfasında adını arayın/,
    );

    // And it says itself once. That the flag ARRIVED is what the box
    // above proves -- the page draws nothing without it. That it does
    // not stay is this: it leaves the address as soon as the words are
    // on screen, so a reload does not report a save that already
    // happened and a bookmark of this page is a visit, not a receipt.
    //
    // Deliberately not asserted the other way round. A `toHaveURL` on
    // `?created=` would be racing the effect that removes it, and an
    // assertion whose truth depends on which of two things the browser
    // does first is a red suite waiting for a faster machine.
    await expect(page).toHaveURL(/\/visits\/(?!new)[^/?]+$/);
    await page.reload();
    await expect(main).toContainText("Limon");
    await expect(receipt).toHaveCount(0);

    // And they are records, not a sentence on one page: the animal is
    // findable tomorrow morning, and so is the person to ring.
    await page.goto("/pets");
    await expect(page.getByRole("main")).toContainText("Limon");
    await page.goto("/clients");
    await expect(page.getByRole("main")).toContainText("Ayşe");
  });

  // The chain itself is not gone, and this is where it still lives: an
  // animal being registered on its own form still needs an owner, and
  // that walk is one link rather than two.
  test("a client made from the animal form comes back to it", async ({
    page,
  }) => {
    await signUp(page, Date.now());

    await page.goto("/pets/new");
    const main = page.getByRole("main");
    await main
      .getByRole("combobox", { name: /^owner$|^sahibi$/i })
      .fill("Devrim Aksoy");
    await main.getByRole("option", { name: /Devrim Aksoy/ }).last().click();
    await expect(page).toHaveURL(/\/clients\/new\?.*name=Devrim\+Aksoy/);
    // The name arrives split into both halves, editable: a wrong guess
    // costs a keystroke, retyping costs the thing the vet called a door.
    await expect(page.getByLabel(/first name|^ad$/i)).toHaveValue("Devrim");
    await expect(page.getByLabel(/last name|soyad/i)).toHaveValue("Aksoy");

    await page.getByLabel(/^phone$|^telefon$/i).first().fill("0532 111 22 33");
    await page
      .getByRole("button", { name: /create client|müşteri oluştur/i })
      .click();
    await expect(page).toHaveURL(/\/pets\/new\?.*ownerId=/);
    await expect(page.getByLabel(/^owner$|^sahibi$/i)).toHaveValue(
      "Devrim Aksoy",
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
    await page.getByLabel(/phone|telefon/i).first().fill("0532 222 33 44");
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
    // The second step is a picker row rather than a door now, and the
    // name typed into it travels: see the walk above.
    await main
      .getByRole("combobox", { name: /^owner$|^sahibi$/i })
      .fill("Kerem Doğan");
    await main.getByRole("option", { name: /Kerem Doğan/ }).last().click();
    await expect(page).toHaveURL(/\/clients\/new\?.*name=Kerem\+Do/);
    await page.getByLabel(/phone|telefon/i).first().fill("0532 333 44 55");
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
