/**
 * What a vaccination's next date means today, for one row on the animal's
 * page. The same rule as the dashboard's overdue card (`overdueWhere`):
 * past due, not closed, not answered by a later dose. The card's six-month
 * window is not applied here -- the window keeps a backlog list workable,
 * and on the animal's own page an old missed booster is still missed.
 */
export type DueState =
  | { kind: "overdue"; days: number }
  | { kind: "superseded" }
  | { kind: "none" };

const DAY_MS = 86_400_000;

export function dueState(
  row: { nextDueAt: Date | null; dueDismissedAt: Date | null; supersededById: string | null },
  now: Date = new Date(),
): DueState {
  if (row.supersededById) return { kind: "superseded" };
  if (!row.nextDueAt || row.dueDismissedAt) return { kind: "none" };
  if (row.nextDueAt >= now) return { kind: "none" };
  return { kind: "overdue", days: Math.floor((now.getTime() - row.nextDueAt.getTime()) / DAY_MS) };
}
