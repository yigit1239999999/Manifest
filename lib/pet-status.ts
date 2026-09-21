// One answer to "may we act on this animal's behalf?", shared by the two
// modules that have to ask it.
//
// It used to live in `modules/notifications/service.ts`, which was the only
// caller. Reminders now has to ask the same question at creation time, and
// importing a service that carries Prisma, the transports and the sweep in
// order to read two booleans is how a module graph turns into a cycle
// waiting to happen. A predicate with no dependencies belongs where both
// can reach it, rather than being written a second time and drifting
// (TEAM.md #30).

/**
 * An animal we must not write to its owner about, and must not schedule
 * anything for. A reminder for a pet that died is the one message that ends
 * a clinic's trust in the whole system, and an archived record is one the
 * clinic has deliberately put away.
 */
export function isPetSilenced(
  pet: { deceased: boolean; archivedAt: Date | null } | null | undefined,
): boolean {
  return pet != null && (pet.deceased || pet.archivedAt != null);
}
