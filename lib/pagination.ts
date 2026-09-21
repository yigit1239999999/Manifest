// Centralised pagination defaults. Touch these here once instead of
// sweeping scattered `take: 200|100|50|25|5` literals across modules.

/** Sane upper bound on any single page size. Defends against abuse. */
export const MAX_PAGE_SIZE = 500;

/** Default page sizes per use-case. */
export const PAGE_SIZES = {
  /** Standard table page. */
  DEFAULT: 25,
  /** Pet grid card layout (3 cols × 8 rows). */
  PETS: 24,
  /** Larger lists where scrolling beats clicking — visits, audit log. */
  LIST: 100,
  /**
   * Select dropdowns populated from a tenant.
   *
   * A cap with nothing saying it is a cap. Past it, records simply are not
   * there: the 501st client cannot be put on an invoice, and searching
   * does not help because the picker filters what it was handed. Worse,
   * who disappears is not random — clients are ordered by surname, so it
   * is the end of the alphabet; animals by age, so it is the oldest, which
   * belong to the longest-standing customers.
   *
   * Fifty now that the pickers can ask the server (`onSearch`), down from
   * five hundred. The number is no longer a wall: past it the picker
   * searches rather than simply not showing the rest, so the list can be
   * the size that is comfortable to look through instead of the size that
   * tries to contain a clinic.
   *
   * Five hundred rows were also five hundred rows of payload on every
   * form page, whether or not the picker was ever opened — about 63 KB of
   * clients and 78 KB of animals, and `/reminders` carried both.
   *
   * It could not be lowered before the search existed: doing that would
   * have lost more people, not fewer.
   */
  DROPDOWN: 50,
  /**
   * A picker's worth of search results. Larger than the palette's five —
   * a list is being chosen from, not jumped to — and small enough that the
   * answer arrives while the next key is being pressed.
   */
  SEARCH_RESULTS: 20,
  /** Audit log viewer. */
  AUDIT: 200,
  /** Dashboard / preview lists. */
  PREVIEW: 5,
  /** Command palette quick-search hits per entity. */
  COMMAND_PALETTE: 5,
} as const;

/**
 * Clamps a requested page size to [1, MAX_PAGE_SIZE]. Use at the
 * boundary where untrusted ?perPage= comes in.
 */
export function clampPageSize(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(value, MAX_PAGE_SIZE);
}

export function clampPage(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}
