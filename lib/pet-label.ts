/**
 * How an animal is named wherever it has to be told apart from another one.
 *
 * A clinic of any size has several animals with the same name -- the vet
 * this was written for keeps three Zeytins and four Pamuks, and called that
 * normal rather than unusual. So a picker row reading just "Zeytin" three
 * times does not merely look untidy: it is the shape of writing a visit,
 * or a prescription, into the wrong animal's record. That was named as the
 * single thing they are most afraid of.
 *
 * The owner is what tells them apart, because "whose cat" is the key a vet
 * actually holds in their head. The last visit date was asked for too and
 * is deliberately not here: it refreshes a memory, it does not
 * disambiguate -- all three Zeytins have one -- and a third part wraps the
 * row at 390px, which costs more in a fifty-row list than the date pays
 * back. The one case the owner does not settle is two clients with the
 * same name; if a clinic reports that, the date earns its place then.
 *
 * Where it does NOT belong, and the boundary is worth stating because
 * three places build this string by hand on purpose. This function is
 * for telling one animal from another: a picker row, a list column --
 * anywhere rows sit side by side and the reader must pick. A record's
 * own page is the other case. There is one animal there, nothing to
 * tell apart, and the owner's name is context rather than a
 * definition; `visits/[id]` even puts the date first, which is not a
 * disagreement with this format but a different job. Routing those
 * through here would make "the right format" a single answer to two
 * questions.
 *
 * One line, one separator, animal first: the vet scans for the animal's
 * name, and the owner is the tiebreaker, not the heading.
 *
 * It lives in its own module, imported by both server actions and client
 * forms, because the format was written out by hand in two places and
 * missing from two others -- and the two that had it disagreed with the
 * two that did not *inside a single dropdown*: `Combobox` appends server
 * search hits after the local options, so a clinic over the list cap could
 * see "Zeytin", "Zeytin · Ayşe Yılmaz" and "Zeytin" stacked together, the
 * rows without an owner reading as though they were a different kind of
 * thing.
 */
export function petLabel(pet: { name: string; ownerName: string }): string {
  return `${pet.name} · ${pet.ownerName}`;
}

/** The owner's name as the label above spells it, from a loaded row. */
export function ownerLabel(owner: {
  firstName: string;
  lastName: string;
}): string {
  return `${owner.firstName} ${owner.lastName}`;
}
