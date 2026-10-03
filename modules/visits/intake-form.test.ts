import { describe, expect, it } from "vitest";
import { visitIntakeSchema } from "./schema";
import { intakeFrom, namedErrors, onScreen } from "./intake-fields";

// The contract between what the form renders and what the schema
// reads. It is a test rather than a note because the two are written
// by two people in two files, and the names are the whole of the
// agreement.

const base = () => {
  const fd = new FormData();
  fd.set("visitedAt", "2026-09-22T10:00");
  fd.set("type", "SICK_VISIT");
  fd.set("chiefComplaint", "Ceviz kusuyor");
  return fd;
};

const parse = (fd: FormData) => visitIntakeSchema("tr").safeParse(intakeFrom(fd));

describe("a visit that brings its animal, as the form sends it", () => {
  it("reads the animal and the owner out of the bracketed names", () => {
    const fd = base();
    fd.set("newPet[intent]", "1");
    fd.set("newPet[name]", "Ceviz");
    fd.set("newPet[species]", "CAT");
    fd.set("newOwner[intent]", "1");
    fd.set("newOwner[firstName]", "Yonca");
    fd.set("newOwner[phone]", "0532 111 22 33");
    fd.set("newOwner[consent]", "true");

    const parsed = parse(fd);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.newPet).toMatchObject({
      name: "Ceviz",
      species: "CAT",
      owner: { firstName: "Yonca", phone: "0532 111 22 33", consent: true },
    });
  });

  // The vet picked an animal, then changed their mind and asked for a
  // new one. The old id is still in the hidden input, and without this
  // it would win silently -- the visit would be written against the
  // animal they moved on from.
  it("drops an animal that was picked before the branch was opened", () => {
    const fd = base();
    fd.set("petId", "p-old");
    fd.set("newPet[intent]", "1");
    fd.set("newPet[name]", "Ceviz");
    fd.set("newPet[species]", "CAT");
    fd.set("newPet[ownerId]", "c-1");

    const parsed = parse(fd);

    expect(parsed.data?.petId).toBeNull();
    expect(parsed.data?.newPet?.ownerId).toBe("c-1");
  });

  // "Do not ask now" carries an empty string, and that has to reach the
  // column as nothing at all -- the same value a client born unasked
  // carries. Anything else would invent a fourth state for every
  // consumer of this column to learn.
  it("records a postponed consent as no answer", () => {
    const fd = base();
    fd.set("newPet[intent]", "1");
    fd.set("newPet[name]", "Ceviz");
    fd.set("newPet[species]", "CAT");
    fd.set("newOwner[intent]", "1");
    fd.set("newOwner[firstName]", "Yonca");
    fd.set("newOwner[phone]", "0532 111 22 33");
    fd.set("newOwner[consent]", "");

    const parsed = parse(fd);

    expect(parsed.data?.newPet?.owner?.consent).toBeUndefined();
  });

  it("leaves an ordinary visit alone", () => {
    const fd = base();
    fd.set("petId", "p-1");

    const parsed = parse(fd);

    expect(parsed.data?.petId).toBe("p-1");
    expect(parsed.data?.newPet).toBeUndefined();
  });

  it("refuses a visit with neither an animal nor a new one", () => {
    const parsed = parse(base());

    expect(parsed.success).toBe(false);
    expect(namedErrors(parsed.error!).petId).toBeTruthy();
  });

  it("refuses a new animal with no owner at all", () => {
    const fd = base();
    fd.set("newPet[intent]", "1");
    fd.set("newPet[name]", "Ceviz");
    fd.set("newPet[species]", "CAT");

    const parsed = parse(fd);

    expect(parsed.success).toBe(false);
    expect(namedErrors(parsed.error!)["newPet[ownerId]"]).toBeTruthy();
  });

  // The error has to land under the box it is about. Keyed on the
  // schema's own path it would read "newPet", which is not a field on
  // screen -- so the message would go to the form-level box and the
  // summary's way back to the control would be gone.
  it("puts a complaint about the telephone under the telephone", () => {
    const fd = base();
    fd.set("newPet[intent]", "1");
    fd.set("newPet[name]", "Ceviz");
    fd.set("newPet[species]", "CAT");
    fd.set("newOwner[intent]", "1");
    fd.set("newOwner[firstName]", "Yonca");
    fd.set("newOwner[phone]", "yok");

    const parsed = parse(fd);

    expect(parsed.success).toBe(false);
    expect(Object.keys(namedErrors(parsed.error!))).toEqual(["newOwner[phone]"]);
  });

  // The number is what the clinic finds the animal by afterwards, and
  // on the examination table it is the thing the vet is least likely
  // to have -- the animal is in front of them, the owner is a name.
  // Required, it produced a made-up number; absent with nothing said,
  // it is indistinguishable from a field somebody has not reached yet.
  // So: one or the other, and the tick is the "other".
  it("takes an owner whose number will be asked for later", () => {
    const fd = base();
    fd.set("newPet[intent]", "1");
    fd.set("newPet[name]", "Limon");
    fd.set("newPet[species]", "CAT");
    fd.set("newOwner[intent]", "1");
    fd.set("newOwner[firstName]", "Ayşe");
    fd.set("newOwner[phoneLater]", "on");

    const parsed = parse(fd);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.newPet?.owner?.phone).toBeNull();
    // Never a column, and never on its way to one.
    expect(parsed.data?.newPet?.owner).not.toHaveProperty("phoneLater");
  });

  it("refuses an owner with neither a number nor a word about it", () => {
    const fd = base();
    fd.set("newPet[intent]", "1");
    fd.set("newPet[name]", "Limon");
    fd.set("newPet[species]", "CAT");
    fd.set("newOwner[intent]", "1");
    fd.set("newOwner[firstName]", "Ayşe");

    const parsed = parse(fd);

    expect(parsed.success).toBe(false);
    expect(Object.keys(namedErrors(parsed.error!))).toEqual(["newOwner[phone]"]);
  });

  // A number that was read out wins over a box that says there is none:
  // the tick is a statement about the minute, the number is the fact.
  it("keeps a number that was given even when the box is ticked", () => {
    const fd = base();
    fd.set("newPet[intent]", "1");
    fd.set("newPet[name]", "Limon");
    fd.set("newPet[species]", "CAT");
    fd.set("newOwner[intent]", "1");
    fd.set("newOwner[firstName]", "Ayşe");
    fd.set("newOwner[phone]", "0532 111 22 33");
    fd.set("newOwner[phoneLater]", "on");

    const parsed = parse(fd);

    expect(parsed.data?.newPet?.owner?.phone).toBe("0532 111 22 33");
  });

  // The owner branch is a choice, not an inference. It used to be read
  // off the first name being non-empty, which reads an empty box as a
  // closed branch: a vet who cleared the name was told to "select an
  // owner" under a picker they had deliberately stepped past.
  it("puts a nameless owner under the owner's name box", () => {
    const fd = base();
    fd.set("newPet[intent]", "1");
    fd.set("newPet[name]", "Limon");
    fd.set("newPet[species]", "CAT");
    fd.set("newOwner[intent]", "1");
    fd.set("newOwner[phone]", "0532 111 22 33");

    const parsed = parse(fd);

    expect(parsed.success).toBe(false);
    expect(Object.keys(namedErrors(parsed.error!))).toEqual([
      "newOwner[firstName]",
    ]);
  });

  it("takes an owner who was picked, with no branch open", () => {
    const fd = base();
    fd.set("newPet[intent]", "1");
    fd.set("newPet[name]", "Limon");
    fd.set("newPet[species]", "CAT");
    fd.set("newPet[ownerId]", "c-1");

    const parsed = parse(fd);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.newPet?.ownerId).toBe("c-1");
    expect(parsed.data?.newPet?.owner).toBeUndefined();
  });

  // Same rule as the animal one level up: an open branch means the vet
  // has moved on from what the picker underneath it still holds.
  it("drops an owner that was picked before the owner branch was opened", () => {
    const fd = base();
    fd.set("newPet[intent]", "1");
    fd.set("newPet[name]", "Limon");
    fd.set("newPet[species]", "CAT");
    fd.set("newPet[ownerId]", "c-old");
    fd.set("newOwner[intent]", "1");
    fd.set("newOwner[firstName]", "Ayşe");
    fd.set("newOwner[phoneLater]", "on");

    const parsed = parse(fd);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.newPet?.ownerId).toBeNull();
    expect(parsed.data?.newPet?.owner?.firstName).toBe("Ayşe");
  });

  it("puts a nameless animal under the animal's name box", () => {
    const fd = base();
    fd.set("newPet[intent]", "1");
    fd.set("newPet[species]", "CAT");
    fd.set("newPet[ownerId]", "c-1");

    const parsed = parse(fd);

    expect(Object.keys(namedErrors(parsed.error!))).toEqual(["newPet[name]"]);
  });
});

/**
 * The other direction: a complaint the SERVICE raised, landing on the
 * box it is about.
 *
 * `createVisitWithIntake` refuses an owner from another clinic under
 * the name it knows the field by, and this form calls that box
 * something else. Without the translation the message goes to the
 * form-level box with no way back to the control, which is the defect
 * `namedErrors` exists to prevent, arriving from the far side.
 */
describe("what the service calls a field, and what the screen calls it", () => {
  it("moves the owner's complaint onto the owner's box", () => {
    expect(onScreen({ ownerId: ["error.validation.ownerNotInClinic"] })).toEqual(
      { "newPet[ownerId]": ["error.validation.ownerNotInClinic"] },
    );
  });

  // A message in the wrong place is bad; a message nowhere is worse.
  it("leaves a name it does not know alone", () => {
    expect(onScreen({ vetId: ["error.validation.vetRequired"] })).toEqual({
      vetId: ["error.validation.vetRequired"],
    });
  });
});
