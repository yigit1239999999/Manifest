import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { can, type Permission, type UserRole } from "@/lib/permissions";

const ROLES: readonly UserRole[] = [
  "ADMIN",
  "VETERINARIAN",
  "VET_TECH",
  "RECEPTIONIST",
];

// Two of the five states of a screen (TEAM.md #19) are decided by routing,
// not by a component: what a user sees when the record is gone, and what a
// user sees when their role does not reach the page. Both regress silently —
// nothing throws, no screen breaks, the user just lands somewhere unhelpful —
// so the rule lives here rather than in a task description.

const appDir = fileURLToPath(new URL("./(app)", import.meta.url));

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = `${dir}/${entry}`;
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

const pages = filesUnder(appDir).filter((f) => f.endsWith("page.tsx"));

/** The first path segment under `(app)`, e.g. "pets" for /pets/[id]/edit. */
function sectionOf(file: string): string {
  return file.slice(appDir.length + 1).split("/")[0];
}

/** The route, as a reader of a failure would name it: "pets/[id]/page.tsx". */
function routeOf(file: string): string {
  return file.slice(appDir.length + 1);
}

describe("notFound() boundaries", () => {
  // Next resolves `notFound()` to the nearest `not-found.tsx` above the
  // throwing route. A section without one falls through to the shell-wide
  // boundary, whose only way out is the dashboard — so the user has to find
  // their way back to the list they were already in.
  it("every section that throws notFound() has its own boundary", () => {
    const sections = new Set(
      pages
        .filter((f) => readFileSync(f, "utf8").includes("notFound()"))
        .map(sectionOf),
    );

    const missing = [...sections].filter((section) => {
      const files = readdirSync(`${appDir}/${section}`);
      return !files.includes("not-found.tsx");
    });

    expect(missing).toEqual([]);
  });
});

describe("permission boundaries", () => {
  // A `redirect("/")` on a failed permission check reads, from the outside,
  // exactly like a bug: a bookmark or a shared link drops the user on the
  // dashboard with no explanation, so the natural next move is to click the
  // same link again. Being told no is a state; an unexplained relocation
  // is not one.
  //
  // Only the permission guard is in scope. A `redirect("/")` because the
  // data a page needs is missing is a different situation with a different
  // answer, so the match is anchored on the guard itself rather than on the
  // page merely containing both.
  it("no page redirects instead of showing the forbidden state", () => {
    const offenders = pages.filter((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(/!can\(/g)].some((m) =>
        source.slice(m.index, m.index + 160).includes("redirect("),
      );
    });

    expect(offenders.map(sectionOf)).toEqual([]);
  });
});

describe("actions that lead somewhere the role may not go", () => {
  // The third way a screen promises what it cannot deliver, after the two
  // above: a button that takes someone to a form the server will refuse.
  //
  // There is no security hole here and the comment has to say so, or the
  // next reader mistakes this for an access check and trusts it in the wrong
  // place. The services enforce the same permissions themselves
  // (`modules/appointments/service.ts:22`, `:58`, `:95`, and their
  // counterparts). What is protected is honesty: a vet tech was shown
  // "Edit", "Cancel the appointment" and "Record the outcome" on an
  // appointment they have no write permission for, and every one of those
  // clicks ended in a refusal — or worse, in a form that looked fillable.
  //
  // Ten pages were fixed by hand. Nothing told the person writing the
  // eleventh, which is exactly how the same class came back one screen over
  // after `/audit` was fixed (TEAM.md #4, #6).

  /** `href="/pets/new"` and `` href={`/pets/${id}/edit`} `` alike. */
  const HREF = /href=(\{`[^`]*`\}|"[^"]*")/g;
  const WRITE_ROUTE = /\/(edit|new)(\?[^"`]*)?("|`)/;

  const offersWriteRoute = (source: string) =>
    [...source.matchAll(HREF)].some((m) => WRITE_ROUTE.test(m[0]));

  const withWriteRoute = pages.filter((file) =>
    offersWriteRoute(readFileSync(file, "utf8")),
  );

  it("finds them at all, so a regex that stopped matching cannot pass", () => {
    expect(withWriteRoute.length).toBeGreaterThan(5);
  });

  it("every page offering one asks whether the role may", () => {
    const offenders = withWriteRoute.filter(
      (file) => !readFileSync(file, "utf8").includes("can("),
    );

    expect(offenders.map(routeOf)).toEqual([]);
  });

  // What this deliberately does NOT check, so that nobody reads more
  // assurance into a green run than it gives: that the page asks about *this*
  // link, or that it asks about the right permission. `/pets/new` passes on
  // the strength of a `can()` guarding something else entirely. Both would
  // need the call graph rather than the file, and the coarse version already
  // catches the failure that actually happened — a page that never asked at
  // all. The permission matching the service's is a review question, and the
  // reason it is written down is in the page: the screen has to ask the same
  // question the server answers, or the two drift into a hidden door that is
  // open, or a visible one that is shut.
});

describe("the permission a screen reads is the one a service enforces", () => {
  // The coarse check above asks whether a page thought about roles at all.
  // This one asks the question the fixes were actually about: the permission
  // the screen reads has to be the permission the server demands for the
  // route it is offering, not a neighbour of it. `can(role, "clients.write")`
  // beside a link to `/pets/new` reads as guarded and is not — a receptionist
  // passes, a vet tech is shown a door that shuts.
  //
  // The expectation is read out of the service rather than listed here, so
  // that moving a mutation to another permission moves the test with it
  // instead of leaving a copy behind that is right about a past release.

  const modulesDir = fileURLToPath(new URL("../modules", import.meta.url));

  /** `/pets/${id}/edit` -> "pets"/"edit"; anything else -> null. */
  function writeRoute(
    href: string,
  ): { section: string; kind: "new" | "edit" } | null {
    const [path] = href.split("?");
    const segments = path.split("/").filter(Boolean);
    const kind = segments.at(-1);
    if (kind !== "new" && kind !== "edit") return null;
    if (!path.startsWith("/")) return null;
    return { section: segments[0], kind };
  }

  /** The permission `createX`/`updateX` demands, read from the service. */
  function servicePermission(
    section: string,
    kind: "new" | "edit",
  ): Permission | null {
    const verb = kind === "new" ? "create" : "update";
    const source = readFileSync(`${modulesDir}/${section}/service.ts`, "utf8");
    const declarations = [
      ...source.matchAll(
        new RegExp(`^export (?:async )?function ${verb}[A-Za-z]*\\(`, "gm"),
      ),
    ];
    // Two of them and the route no longer names one mutation; resolving it
    // to the first would guess. Let the unresolved case fail instead.
    if (declarations.length !== 1) return null;
    const body = source.slice(declarations[0].index);
    return (body.match(/requirePermission\([^,]+,\s*"([^"]+)"\)/)?.[1] ??
      null) as Permission | null;
  }

  const HREF = /href=(?:\{`([^`]*)`\}|"([^"]*)")/g;

  type Offer = {
    file: string;
    source: string;
    href: string;
    section: string;
    kind: "new" | "edit";
  };

  // Typed here rather than inferred: spreading `route` through two
  // `flatMap`s widens `kind` back to `string`, and then every call below
  // has to narrow it again.
  const offers: Offer[] = pages.flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return [...source.matchAll(HREF)].flatMap((match) => {
      const href = match[1] ?? match[2];
      const route = writeRoute(href);
      return route ? [{ file, source, href, ...route }] : [];
    });
  });

  it("finds the links at all, so an href style it cannot read cannot pass", () => {
    expect(offers.length).toBeGreaterThan(10);
  });

  it("can name the permission behind every route it found", () => {
    const unresolved = offers.filter(
      (offer) => servicePermission(offer.section, offer.kind) === null,
    );

    expect(unresolved.map((o) => `${routeOf(o.file)} -> ${o.href}`)).toEqual([]);
  });

  /** The permission a page's own gate demands, if it has one. */
  function pageGuard(source: string): Permission | null {
    return (source.match(/!can\([^,]+,\s*"([^"]+)"\)/)?.[1] ?? null) as
      | Permission
      | null;
  }

  /** Roles that get as far as rendering this page. */
  function rolesReaching(source: string): readonly UserRole[] {
    const guard = pageGuard(source);
    return guard ? ROLES.filter((role) => can(role, guard)) : ROLES;
  }

  it("every screen asks about that permission before offering the route", () => {
    // The rule is not "every link is guarded" — that one has to be argued
    // out of the way with an exemption list the first time it is wrong, and
    // an exemption list is the same trap as a word list: it gets longer,
    // and nobody remembers why any entry is in it.
    //
    // The rule is that nobody sees a link they cannot use. So the question
    // is asked of the permission matrix: is there a role that gets as far
    // as this page and does not hold what the link needs? `/pets/new` links
    // to `/clients/new` unguarded and is not a defect, because the page
    // itself is behind `pets.write` and every role holding that holds
    // `clients.write` too — a guard there would be a condition that cannot
    // be false (TEAM.md #30). No exception is written down for it; the
    // matrix says so, and on the day the matrix stops saying so this turns
    // red by itself. That is the part a list could never do.
    const offenders = offers.filter((offer) => {
      const permission = servicePermission(offer.section, offer.kind);
      if (permission === null) return false;
      if (new RegExp(`can\\([^)]*"${permission}"\\)`).test(offer.source)) return false;
      return rolesReaching(offer.source).some((role) => !can(role, permission));
    });

    expect(
      offenders.map(
        (o) =>
          `${routeOf(o.file)} offers ${o.href} without ` +
          `${servicePermission(o.section, o.kind)}`,
      ),
    ).toEqual([]);
  });

  // Three things this deliberately does not check, so that a green run is
  // not read as more than it is:
  //
  //   - it pairs a *page* with a permission, not a *button*. A page holding
  //     both `pets.write` and a link to `/pets/new` passes even if the link
  //     renders under some other check it happens to hold. Catching that
  //     needs the render tree; the failure that actually happened twice is
  //     the one caught here, the permission nobody read.
  //   - it reads the route's permission, not the page's other actions. The
  //     forms that post from a detail page are a separate check below.
  //   - it proves nothing about the server. That the service still enforces
  //     the permission it declares is the service tests' job; this only
  //     keeps the screen honest about it.
});

describe("the write routes themselves", () => {
  // The buttons were put behind permission checks one screen at a time, and
  // that turned out to be half the job: the doors they led to were still
  // open. A `VET_TECH` could type `/pets/new` — or follow a link from
  // somewhere the sweep had not reached — fill the form in, submit it, and
  // be refused by the service after the typing. Nine of the ten write routes
  // were like that; only `/staff/new` had ever asked.
  //
  // Hiding a button is a courtesy. This is the part that makes the courtesy
  // true, and it is still not the security boundary: the services enforce
  // these permissions themselves and always did. The failure being prevented
  // is wasted work and a screen that behaved as though it would accept
  // something it could not.
  //
  // The route decides, not the file's contents: anything under `/new` or
  // `/edit` exists to write, so there is no judgement call about which pages
  // this covers and no way to add one that quietly falls outside.
  const writeRoutes = pages.filter((file) =>
    /\/(new|edit)\/page\.tsx$/.test(file),
  );

  it("finds them at all, so a path that stopped matching cannot pass", () => {
    expect(writeRoutes.length).toBeGreaterThan(5);
  });

  it("every one of them refuses a role that cannot write", () => {
    // `!can(` and not merely `can(`: two of these pages already called
    // `can()` to decide whether to offer a link to the species settings,
    // which looks like a guard from a distance and stops nobody.
    const ungated = writeRoutes.filter((file) => {
      const source = readFileSync(file, "utf8");
      return !source.includes("!can(") || !source.includes("ForbiddenState");
    });

    expect(ungated.map(routeOf)).toEqual([]);
  });
});

describe("the forms inside a record's page", () => {
  // The sweep above walks links. These are not links: they are forms that
  // post straight from a detail page — add a vaccination, write a
  // prescription, record a payment — and the first pass missed them
  // entirely, because it was looking for `href`.
  //
  // They are the worse half. A button that refuses costs a click; a
  // prescription form costs the drug, the dose and the instructions,
  // typed out in full and gone on submit. A vet tech has no
  // `prescriptions.write` and a receptionist has none of the clinical
  // permissions at all, so between them that was eight of nine forms on
  // two screens.
  //
  // Each form is paired with the permission its own service enforces, and
  // the pairing is the assertion: the pages did hold `can()` calls — four
  // of them on `/pets/[id]` — and none were connected to these blocks, so
  // "does the page ask" was already true and already useless.
  const FORMS: { page: string; form: string; permission: Permission }[] = [
    { page: "visits/[id]", form: "VaccinationForm", permission: "vaccinations.write" },
    { page: "visits/[id]", form: "PrescriptionForm", permission: "prescriptions.write" },
    { page: "visits/[id]", form: "TreatmentForm", permission: "treatments.write" },
    { page: "visits/[id]", form: "DiagnosticForm", permission: "diagnostics.write" },
    { page: "pets/[id]", form: "VaccinationForm", permission: "vaccinations.write" },
    { page: "pets/[id]", form: "PrescriptionForm", permission: "prescriptions.write" },
    { page: "pets/[id]", form: "TreatmentForm", permission: "treatments.write" },
    { page: "pets/[id]", form: "DiagnosticForm", permission: "diagnostics.write" },
    { page: "pets/[id]", form: "NoteForm", permission: "notes.write" },
    { page: "invoices/[id]", form: "PaymentForm", permission: "payments.write" },
    { page: "reminders", form: "ReminderForm", permission: "reminders.write" },
  ];

  const sourceOf = (page: string) =>
    readFileSync(`${appDir}/${page}/page.tsx`, "utf8");

  it("every one of them is rendered behind its own permission", () => {
    // Behind it *when there is someone to keep out*. The same question the
    // link sweep asks, and for the same reason: every role holds
    // `reminders.write`, so guarding the reminder form would be a
    // condition that cannot be false — dead code telling the next reader a
    // case exists when it does not (TEAM.md #30). The matrix decides, not
    // a list of exceptions, so the day a role loses that permission this
    // starts demanding the guard on its own.
    const offenders = FORMS.filter(({ page, form, permission }) => {
      if (ROLES.every((role) => can(role, permission))) return false;
      const source = sourceOf(page);
      // The flag has to be read from that permission *and* be the condition
      // this form renders under. Both halves matter: `/pets/[id]` carried
      // four correct `can()` calls while all four forms rendered
      // unconditionally.
      const flag = source.match(
        new RegExp(`const (\\w+) = can\\([^)]*"${permission}"\\)`),
      )?.[1];
      if (!flag) return true;
      const rendered = source.indexOf(`<${form}`);
      // `{flag && (` and `{flag && somethingElse && (` alike — the payment
      // form also waits for the invoice to be unpaid.
      return !source.slice(0, rendered).includes(`{${flag} &&`);
    });

    expect(offenders.map((f) => `${f.page} ${f.form} (${f.permission})`)).toEqual([]);
  });

  it("leaves the records already there on screen", () => {
    // The list is reading, and reading is allowed. Hiding it would take the
    // vaccination history away from a receptionist who is allowed to see it,
    // and a row that disappears reads as data loss rather than as a limit
    // (TEAM.md #16c). Only the "Add" block goes.
    for (const page of ["visits/[id]", "pets/[id]"]) {
      const source = sourceOf(page);
      // The empty state and the list both sit outside any `canAdd…` block:
      // if one had been swept up with the form, it would be inside one.
      const emptyStates = [...source.matchAll(/<EmptyState[\s\S]{0,200}?\/>/g)];
      expect(emptyStates.length).toBeGreaterThan(0);
      for (const match of emptyStates) {
        const before = source.slice(0, match.index);
        const opened = (before.match(/\{canAdd\w+ && \(/g) ?? []).length;
        const closed = (before.match(/^\s{10,}\)\}$/gm) ?? []).length;
        expect(opened).toBeLessThanOrEqual(closed);
      }
    }
  });

  it("covers every action form on those pages, so none is simply forgotten", () => {
    for (const page of [
      "visits/[id]",
      "pets/[id]",
      "invoices/[id]",
      "reminders",
    ]) {
      const rendered = new Set(
        [...sourceOf(page).matchAll(/<([A-Z]\w*Form)\b/g)].map((m) => m[1]),
      );
      const listed = new Set(
        FORMS.filter((f) => f.page === page).map((f) => f.form),
      );
      expect([...rendered].filter((f) => !listed.has(f))).toEqual([]);
    }
  });
});
