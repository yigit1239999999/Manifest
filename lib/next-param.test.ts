import { describe, expect, it } from "vitest";
import { createHref, safeNext, withCreated } from "./next-param";

// `next` decides where a browser goes after a trusted action, which is
// the shape of every open-redirect hole ever shipped. One module,
// because a rule copied into four call sites is wrong at the fourth.
describe("safeNext", () => {
  it("keeps the four places a chain can lead", () => {
    expect(safeNext("/visits/new")).toBe("/visits/new");
    expect(safeNext("/appointments/new")).toBe("/appointments/new");
    expect(safeNext("/invoices/new")).toBe("/invoices/new");
    expect(safeNext("/pets/new")).toBe("/pets/new");
  });

  // A vet who hit the dead end while reading a list had begun nothing.
  // Sending them to `/appointments/new` after they add an animal would
  // assume they meant to book one; they go back to the list.
  it("keeps the lists those forms are reached from", () => {
    expect(safeNext("/visits")).toBe("/visits");
    expect(safeNext("/appointments")).toBe("/appointments");
    expect(safeNext("/invoices")).toBe("/invoices");
    expect(safeNext("/pets")).toBe("/pets");
    // No `/reminders/new`: that screen carries its form inline, which
    // is why it was the fifth dead end and the last one found.
    expect(safeNext("/reminders")).toBe("/reminders");
  });

  it("hands a list no id, because a list has nowhere to put one", () => {
    expect(withCreated("/appointments", "pet", "p-1")).toBe("/appointments");
    expect(withCreated("/pets", "client", "c-1")).toBe("/pets");
    expect(withCreated("/reminders", "client", "c-1")).toBe("/reminders");
  });

  it("refuses anywhere else in our own product", () => {
    // A whitelist, not a pattern: the question is not whether it looks
    // like our URL but whether it is one of the listed few.
    expect(safeNext("/settings")).toBeNull();
    expect(safeNext("/clients/abc")).toBeNull();
    expect(safeNext("/visits/new/../../settings")).toBeNull();
  });

  it("refuses everything that leaves the site", () => {
    expect(safeNext("https://ornek.test")).toBeNull();
    expect(safeNext("//ornek.test")).toBeNull();
    expect(safeNext("http://ornek.test/visits/new")).toBeNull();
    expect(safeNext("javascript:alert(1)")).toBeNull();
    // A NUL byte and a backslash, built rather than typed so this file
    // contains neither.
    expect(safeNext("/visits/new" + String.fromCharCode(0))).toBeNull();
    expect(safeNext("/visits/new" + String.fromCharCode(92) + "@ornek.test")).toBeNull();
  });

  it("keeps the parameters the chain needs and drops the rest", () => {
    expect(safeNext("/pets/new?ownerId=c-1")).toBe("/pets/new?ownerId=c-1");
    expect(safeNext("/visits/new?petId=p-1")).toBe("/visits/new?petId=p-1");
    // Noise rather than an attack, so the destination survives it.
    expect(safeNext("/visits/new?utm_source=x")).toBe("/visits/new");
  });

  it("validates a nested destination the same way", () => {
    expect(safeNext("/pets/new?next=%2Fvisits%2Fnew")).toBe("/pets/new?next=%2Fvisits%2Fnew");
    // A bad link smuggled inside a good one loses the inside, not the
    // outside: the vet still lands somewhere they asked to be.
    expect(safeNext("/pets/new?next=https%3A%2F%2Fornek.test")).toBe("/pets/new");
    expect(safeNext("/pets/new?next=%2Fsettings")).toBe("/pets/new");
  });

  it("stops nesting before it becomes a cost", () => {
    const one = "/pets/new?next=" + encodeURIComponent("/visits/new");
    const two = "/pets/new?next=" + encodeURIComponent(one);
    const three = "/pets/new?next=" + encodeURIComponent(two);
    const four = "/pets/new?next=" + encodeURIComponent(three);

    // Within the limit every layer survives.
    expect(safeNext(three)).toContain("next");
    // Past it the deepest link is dropped and the rest stands: the
    // limit costs a step, not the journey.
    expect(safeNext(four)).toContain("/pets/new");
  });

  it("treats nothing as nothing", () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext("")).toBeNull();
  });
});

describe("withCreated", () => {
  it("uses the name the destination reads", () => {
    // The bug this closes: one name for both screens sent a client back
    // to `/invoices/new?ownerId=...`, which reads `clientId`, so the
    // picker was empty again one screen further along.
    expect(withCreated("/pets/new", "client", "c-1")).toBe(
      "/pets/new?ownerId=c-1",
    );
    expect(withCreated("/invoices/new", "client", "c-1")).toBe(
      "/invoices/new?clientId=c-1",
    );
    expect(withCreated("/visits/new", "pet", "p-1")).toBe(
      "/visits/new?petId=p-1",
    );
    expect(withCreated("/appointments/new", "pet", "p-1")).toBe(
      "/appointments/new?petId=p-1",
    );
  });

  it("replaces a stale id rather than adding a second", () => {
    expect(withCreated("/visits/new?petId=old", "pet", "p-2")).toBe(
      "/visits/new?petId=p-2",
    );
  });

  it("keeps the rest of the chain intact", () => {
    expect(withCreated("/pets/new?next=%2Fvisits%2Fnew", "client", "c-1")).toBe(
      "/pets/new?next=%2Fvisits%2Fnew&ownerId=c-1",
    );
  });

  it("still lands on the errand when there is nowhere to put the id", () => {
    // A bill needs no animal, so this cannot happen today. Going without
    // the id beats refusing to go.
    expect(withCreated("/invoices/new", "pet", "p-1")).toBe("/invoices/new");
  });
});

// The typed name travels with the errand, so the vet writes it once.
// They measured the version where the chain carried the address but not
// the content and called it the difference between a door that annoys
// and a note that loses them.
describe("createHref", () => {
  it("carries the errand and the name that was typed", () => {
    expect(createHref("/pets/new", "Limon", "/visits/new")).toBe(
      "/pets/new?next=%2Fvisits%2Fnew&name=Limon",
    );
  });

  it("goes without an errand when there is none", () => {
    expect(createHref("/clients/new", "Ayşe Çelik")).toBe(
      "/clients/new?name=Ay%C5%9Fe+%C3%87elik",
    );
  });

  // The whitelist is the same one every other link goes through: a
  // destination nobody may resume at is dropped rather than carried.
  it("refuses to carry an errand that is not ours", () => {
    expect(createHref("/pets/new", "Limon", "https://ornek.test")).toBe(
      "/pets/new?name=Limon",
    );
  });

  it("truncates a name long enough to be something else", () => {
    const long = "a".repeat(200);
    const href = createHref("/pets/new", long);

    expect(new URLSearchParams(href.split("?")[1]).get("name")).toHaveLength(80);
  });

  it("hands the name back through safeNext untouched", () => {
    expect(safeNext("/pets/new?next=%2Fvisits%2Fnew&name=Limon")).toBe(
      "/pets/new?next=%2Fvisits%2Fnew&name=Limon",
    );
  });
});
