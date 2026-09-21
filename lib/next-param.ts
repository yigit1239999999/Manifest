// Where a form should go back to, when the vet arrived from somewhere.
//
// A clinic with no records walks down a chain to create its first one:
// `/visits/new` cannot open without an animal, `/pets/new` without an
// owner. Walking down is handled; walking back up was not, so every save
// landed on the record's own page and the vet had to remember what they
// had been doing and click their way back -- eight screens, two of them
// visited twice.
//
// `next` carries that intent. It is also, in every product that has ever
// had one, an open-redirect hole: a parameter that decides where the
// browser goes after a trusted action. So it is validated here and only
// here, because a rule copied into four call sites is a rule that is
// wrong at the fourth.
//
// A whitelist of exact paths rather than a pattern. The question is not
// "does this look like our URL" but "is it one of the places the chain
// can lead" -- a pattern admits `/settings`, tomorrow's route, and every
// clever encoding of a host.

/**
 * The only destinations a chain may resume at.
 *
 * Two kinds, and the difference is where the vet was when they hit the
 * dead end. From a `/new` form they had already begun the work, so they
 * come back to the form. From a list they had begun nothing -- they
 * were reading -- and sending them to `/appointments/new` after they
 * add an animal would be assuming they meant to book one. They come
 * back to the list they were looking at.
 *
 * A list has no slot for a new record's id (`RECORD_PARAM`), so
 * `withCreated` leaves it alone and the vet simply lands back where
 * they were, with the thing that was missing now present.
 *
 * FOR WHOEVER ADDS THE NEXT `/new` ROUTE: add it here too, or the
 * chain will not resume there. It fails to the safe side -- the old
 * redirect, no error -- which means nothing will look broken and
 * nobody will be told. That is the good failure mode for a redirect
 * and the bad one for noticing, so the note lives at the list rather
 * than in whatever conversation produced it.
 */
const ALLOWED_PATHS = new Set([
  "/visits/new",
  "/appointments/new",
  "/invoices/new",
  "/pets/new",
  "/visits",
  "/appointments",
  "/invoices",
  "/pets",
  // A list like the four above, and a dead end for the same reason: on
  // an empty clinic the reminder form has no client to pick. It is
  // here rather than in the group above because there is no
  // `/reminders/new` -- the form sits inside the page, which is how
  // this screen escaped both sweeps that found the other four.
  "/reminders",
]);

/**
 * The only parameters that survive. Anything else is dropped rather than
 * refused: an unknown key is noise, not an attack, and discarding the
 * whole destination over one would send a vet back to the wrong screen.
 */
const ALLOWED_PARAMS = new Set(["next", "ownerId", "petId", "clientId"]);

/**
 * How deep a chain may nest.
 *
 * The real one is two: `/visits/new` from `/pets/new` from
 * `/clients/new`. A limit exists because recursion over input a stranger
 * can write needs one, not because three means anything.
 */
const MAX_DEPTH = 3;

/** Characters no path of ours contains and every parser disagrees about. */
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * The sanitised destination, or null when there is not one.
 *
 * Null means "behave as though nobody asked", which is the redirect that
 * existed before this. Deliberately not an error screen: a bad `next` is
 * somebody's experiment or a stale link, and neither is worth stopping a
 * vet who has just saved a record.
 */
export function safeNext(raw: string | null | undefined, depth = 0): string | null {
  if (!raw || depth > MAX_DEPTH) return null;
  // Checked before parsing, because parsing is where clever encodings
  // get their chance: a scheme, a protocol-relative host, or a backslash
  // that some browser will read as one.
  if (raw.includes("://") || raw.startsWith("//") || raw.includes("\\")) return null;
  if (CONTROL.test(raw)) return null;
  if (!raw.startsWith("/")) return null;

  let url: URL;
  try {
    // The base is required and never used: only `pathname` and the query
    // survive, so a host cannot be reached even if one is smuggled in.
    url = new URL(raw, "https://example.invalid");
  } catch {
    return null;
  }
  if (!ALLOWED_PATHS.has(url.pathname)) return null;

  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (!ALLOWED_PARAMS.has(key)) continue;
    if (key === "next") {
      // The nested destination gets the same treatment, so a chain
      // cannot smuggle a bad link inside a good one.
      const nested = safeNext(value, depth + 1);
      if (nested) params.set("next", nested);
      continue;
    }
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

/**
 * What each destination calls the record the chain went back to make.
 *
 * Not one name for all four: `/pets/new` asks for the client as
 * `ownerId` and `/invoices/new` as `clientId`, because on one screen the
 * client owns the animal and on the other it owes the money. A single
 * `ownerId` for both -- which is what this did first -- sent a vet back
 * to `/invoices/new?ownerId=...`, where the page reads `clientId`, and
 * the picker was empty again: the exact defect the errand exists to
 * close, moved one screen along.
 *
 * Kept beside the whitelist because both answer the same question --
 * which screens a chain can resume at, and what they need when it does.
 */
const RECORD_PARAM: Record<string, Partial<Record<"client" | "pet", string>>> = {
  "/pets/new": { client: "ownerId" },
  "/invoices/new": { client: "clientId" },
  "/visits/new": { pet: "petId" },
  "/appointments/new": { pet: "petId" },
};

/**
 * The destination with the new record's id under the name that
 * destination uses.
 *
 * The create actions call it to hand back what they just made. When the
 * destination has no slot for that kind of record it is returned
 * untouched: the vet still lands on the errand, which is worth more than
 * refusing to go. That combination -- an animal handed to `/invoices/new`
 * -- cannot arise today, because each screen asks for the link it is
 * missing and a bill needs no animal.
 */
export function withCreated(
  target: string,
  made: "client" | "pet",
  id: string,
): string {
  const [path, query] = target.split("?");
  const key = RECORD_PARAM[path]?.[made];
  if (!key) return target;
  const params = new URLSearchParams(query);
  params.set(key, id);
  return `${path}?${params.toString()}`;
}
