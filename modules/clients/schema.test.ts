import { describe, expect, it } from "vitest";
import { clientSchema } from "./schema";

// The counter meets the client while they are standing there with an
// animal, and the vet said what that costs: "I do not know the surname
// of the lady who brings the street cat, and asking would be rude. If
// you force it I will type a full stop, and the record becomes
// rubbish." A required field does not produce the fact it demands.
//
// The number changed places with it: "if I do not take her phone I will
// never find that animal again" -- it is the clinic's only handle on
// the record, and what every reminder is sent to.

const filled = {
  firstName: "Ayşe",
  lastName: "",
  email: "",
  phone: "0532 111 22 33",
  secondaryPhone: "",
  address: "",
  city: "",
  postalCode: "",
  country: "",
  preferredContact: "",
  preferredLanguage: "",
  notificationsOptIn: "",
  notes: "",
};

describe("the client the counter can actually record", () => {
  it("is accepted without a surname", () => {
    const parsed = clientSchema.safeParse(filled);

    expect(parsed.success).toBe(true);
  });

  // Absence, not emptiness. An empty string sorts ahead of every name,
  // reaches `searchKey` as a real value, and leaves "how many clients
  // have no surname" unanswerable. `Client.lastName` is nullable for
  // this reason and the form has to hand it a null, not a "".
  it("records a missing surname as missing", () => {
    const parsed = clientSchema.parse(filled);

    expect(parsed.lastName).toBeNull();
  });

  it("keeps a surname that was given", () => {
    const parsed = clientSchema.parse({ ...filled, lastName: "Yılmaz" });

    expect(parsed.lastName).toBe("Yılmaz");
  });

  it("refuses a client with no telephone", () => {
    const parsed = clientSchema.safeParse({ ...filled, phone: "" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["phone"]);
  });

  // Loose on format, strict on presence: the counter types what the
  // client says, and a demand they cannot satisfy is what produces the
  // full stop this whole change is about.
  it("takes the number the way somebody says it out loud", () => {
    const parsed = clientSchema.safeParse({
      ...filled,
      phone: "0532 111 22 33",
    });

    expect(parsed.success).toBe(true);
  });

  it("still refuses something that is not a number at all", () => {
    const parsed = clientSchema.safeParse({ ...filled, phone: "yok" });

    expect(parsed.success).toBe(false);
  });
});
