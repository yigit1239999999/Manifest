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
  /** Select dropdowns populated from a tenant — capped at a safe ceiling. */
  DROPDOWN: 500,
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
