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

/**
 * The owner's name as the label above spells it, from a loaded row.
 *
 * The surname may be absent, and absent is not empty: the counter is
 * not allowed to ask the lady who brings the street cat for hers
 * (`Client.lastName`). So the parts are joined rather than
 * concatenated -- `${first} ${last}` left a trailing space, and a
 * picker row reading "Limon · Ayşe " looks like a record with
 * something missing off the end of it rather than a client with one
 * name.
 */
export function ownerLabel(owner: {
  firstName: string;
  lastName: string | null;
}): string {
  return [owner.firstName, owner.lastName].filter(Boolean).join(" ");
}

/**
 * The number to show for an owner, which is not the same as
 * `owner.phone`.
 *
 * A client can be reached on a second line, and a screen that reads
 * only the first one tells the vet "no number" about somebody whose
 * number is on file. That is not a gap, it is a wrong fact, and it is
 * worse than the gap it was meant to close: the animal's page shows
 * this so the vet knows whether to ask, and a dash they trust stops
 * them asking (pm found it on a client with only a second line).
 *
 * Empty strings count as missing, not as an answer. The schema nulls
 * blank input, but a "" arriving from anywhere would be handed
 * straight through by `??` and printed as a number with no digits.
 *
 * What it does NOT do is widen: if both lines are blank the answer is
 * still nothing, even when the client has an e-mail. The row says
 * whether this owner has a PHONE (value).
 */
export function ownerPhone(owner: {
  phone?: string | null;
  secondaryPhone?: string | null;
}): string | null {
  return owner.phone?.trim() || owner.secondaryPhone?.trim() || null;
}

/**
 * The picker row, which is a different job from `petLabel` above and is
 * kept apart on purpose.
 *
 * `petLabel` is one line, for anywhere a name has to fit in a cell or a
 * column: its own note explains why a third part wraps a fifty-row list
 * at 390px, and that reasoning still holds. This is two lines, for the
 * one place where the reader is CHOOSING between animals rather than
 * reading a list of them, and where being wrong means writing a visit
 * into the wrong record.
 *
 * The species sits next to the name because of what the vet is looking
 * at while they choose: "the animal is in front of me, I can see with
 * my own eyes whether it is a cat or a dog". That is the filter that
 * eliminates at a glance, so it has to be readable before the eye
 * reaches the owner. The date is relative -- "7 months ago" -- because
 * "12 March" raised their question rather than answering it: "12 March
 * of which year?". Breed and age were offered and refused in the same
 * breath: "they swell the row and they do not decide anything".
 */
export function petRowLabel(
  name: string,
  speciesLabel: string | null | undefined,
): string {
  return [name, speciesLabel].filter(Boolean).join(" · ");
}

/** The second line: whose animal it is, and when it was last seen. */
export function petRowCaption(
  ownerName: string,
  lastSeen: string | null | undefined,
): string {
  return [ownerName, lastSeen].filter(Boolean).join(" · ");
}
