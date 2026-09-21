// What a vet has typed but not yet saved, kept in the browser.
//
// Measured, on the product as it ships: a vet wrote a chief complaint
// and a history into a visit, went to the client list, came back, and
// both fields were empty -- "and there was no warning on the way out".
// The silence is the worst part of it. A form that loses a paragraph
// and says so costs a retype; one that loses it quietly means the
// examination stays half-written and the vet does not find out that
// day.
//
// Their own scale for it: "a door annoys me, a lost note takes me off
// the program -- I stop trusting it and pick up paper". That is why
// this is not an "are you sure?" dialogue on the way out. Asking the
// question stops the person doing the work a second time, and the
// right behaviour is not to lose the note at all.
//
// SESSION storage, not local. Same tab, survives a reload and every
// in-app navigation, which is the whole of the measured loss. It does
// NOT survive closing the tab, and that is the trade being made: an
// examination's text is clinical, the machine at the counter is
// shared, and leaving paragraphs about a patient on disk for months
// under whoever signs in next buys a crash case nobody has reported.
// If a clinic does report losing a note to a crash, the same functions
// move to localStorage and nothing else changes.
//
// SCOPED BY WHOEVER IS SIGNED IN, and that is not tidiness. Two vets
// share the counter machine inside one browser session; without the
// scope, the second one to sit down would be handed the first one's
// half-written examination, in a form about a different animal. The
// scope comes from `[data-draft-scope]`, written once on the app
// layout's <main>, so a page cannot forget to pass it -- a rule that
// has to be remembered at four call sites is wrong at the fourth.

const PREFIX = "pettrack.draft.v1";

/**
 * Who the drafts on this tab belong to, or null when nobody is signed
 * in (the sign-in page has no `<main data-draft-scope>`).
 *
 * Read from the DOM at call time rather than cached: a sign-out and a
 * new sign-in replace the layout, and a cached value would hand the
 * next person the previous one's keys.
 */
function scope(): string | null {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector("[data-draft-scope]")?.getAttribute("data-draft-scope") ??
    null
  );
}

function storageKey(key: string): string | null {
  const who = scope();
  return who ? `${PREFIX}.${who}.${key}` : null;
}

/**
 * Every call is wrapped: storage throws in private windows, when a
 * quota is full, and when a browser is configured to refuse it. None
 * of those may take a form down -- losing the safety net is bad, and
 * losing the form because the safety net failed is worse.
 */
function safely<T>(run: () => T, fallback: T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}

export function readDraft(key: string): Record<string, string> | null {
  const full = storageKey(key);
  if (!full) return null;
  return safely(() => {
    const raw = window.sessionStorage.getItem(full);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const values: Record<string, string> = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value === "string") values[name] = value;
    }
    return Object.keys(values).length > 0 ? values : null;
  }, null);
}

export function writeDraft(key: string, values: Record<string, string>): void {
  const full = storageKey(key);
  if (!full) return;
  // An untouched form is not a draft. Without this, opening a form and
  // walking away would leave a stored row that later announces "your
  // text has been restored" over nothing.
  if (Object.values(values).every((v) => v === "")) {
    clearDraft(key);
    return;
  }
  safely(() => window.sessionStorage.setItem(full, JSON.stringify(values)), undefined);
}

export function clearDraft(key: string): void {
  const full = storageKey(key);
  if (!full) return;
  safely(() => window.sessionStorage.removeItem(full), undefined);
}
