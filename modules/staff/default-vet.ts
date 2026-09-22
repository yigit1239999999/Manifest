/**
 * The clinician a new record opens with, or nobody.
 *
 * A vet writing up their own examination is the ordinary case, and the
 * honest place to say so is the screen: the name is visible and one
 * click away from being changed. The dishonest place was the service,
 * which used to write `vetId || ctx.userId` -- so a receptionist typing
 * up yesterday's work became the clinician who performed it, in a field
 * nobody ever goes back to correct. That fallback is gone and stays
 * gone; this is the same answer arrived at where it can be seen.
 *
 * Decided from the list the form is ALREADY showing rather than by
 * asking `isClinician` again. It is the same predicate over the same
 * rows -- the query selects active clinicians of this clinic -- and
 * reading it here buys two things: one fewer round trip, and the
 * guarantee that a default is always an option the picker actually has.
 * A default the picker cannot show is a field that looks empty over a
 * full value, which is the state `defaultLabel` exists to prevent.
 *
 * Undefined for everyone else, and that is an answer rather than a
 * gap: "not recorded" is true, and better than a name nobody chose.
 * Reception sees the field open on "none" and picks the vet who saw the
 * animal, which is the only way that field is ever right for them.
 *
 * A function rather than the one-line expression it replaces, because
 * the expression was in two pages and about to be in a third, and
 * because the case that matters -- the receptionist -- is expensive to
 * measure in a browser and free to state here.
 */
export function defaultVetFor(
  clinicians: { id: string }[],
  userId: string,
): string | undefined {
  return clinicians.some((v) => v.id === userId) ? userId : undefined;
}
