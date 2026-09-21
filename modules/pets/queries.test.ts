import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pet: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { listPets, listPetsPage, quickSearchPets } from "./queries";

// See `modules/visits/queries.test.ts`: an archive nobody can list is an
// archive nobody can undo (backlog 39).
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.pet.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.pet.count).mockResolvedValue(0 as never);
});

const callOf = () => vi.mocked(prisma.pet.findMany).mock.calls[0][0];
const whereOf = () => callOf()?.where as Record<string, unknown>;

describe("listPetsPage", () => {
  it("hides archived pets, and pets whose owner is archived", async () => {
    await listPetsPage({ clinicId: "clinic-1" });

    expect(whereOf()).toMatchObject({
      archivedAt: null,
      owner: { archivedAt: null },
    });
  });

  it("drops both conditions when archived rows are asked for", async () => {
    await listPetsPage({ clinicId: "clinic-1", includeArchived: true });

    const where = whereOf();
    expect(where).not.toHaveProperty("archivedAt");
    expect(where).not.toHaveProperty("owner");
    expect(where.clinicId).toBe("clinic-1");
  });

  it("selects the owner's archivedAt, which the card needs to explain itself", async () => {
    // A pet archived by its owner has `archivedAt: null` of its own. Without
    // this field the list would show it unmarked among live rows.
    await listPetsPage({ clinicId: "clinic-1", includeArchived: true });

    const include = callOf()?.include as
      | { owner?: { select?: Record<string, unknown> } }
      | undefined;
    expect(include?.owner?.select).toMatchObject({ archivedAt: true });
  });
});

describe("listPets, the dropdown list", () => {
  // The dropdown cap used to be silent. Past 500 animals the rest simply
  // were not in the picker, search did not help because the picker filters
  // what it was handed, and nothing said so — the list looked complete.
  // Who vanished was not random either: ordered newest-first, it was the
  // oldest animals, which belong to the longest-standing clients.
  it("reads one row past the cap so it can say the list is short", async () => {
    await listPets({ clinicId: "clinic-1", take: 2 });

    expect(callOf()?.take).toBe(3);
  });

  it("reports the cap, and hands back only what was asked for", async () => {
    vi.mocked(prisma.pet.findMany).mockResolvedValue([
      { id: "p-1" },
      { id: "p-2" },
      { id: "p-3" },
    ] as never);

    const { items, hasMore } = await listPets({ clinicId: "clinic-1", take: 2 });

    expect(items).toHaveLength(2);
    expect(hasMore).toBe(true);
  });

  it("says nothing when the list fits", async () => {
    // The hint has to stay off for every clinic that is nowhere near the
    // cap, which is all of them today; a warning everyone sees is one
    // nobody reads.
    vi.mocked(prisma.pet.findMany).mockResolvedValue([{ id: "p-1" }] as never);

    const { items, hasMore } = await listPets({ clinicId: "clinic-1", take: 2 });

    expect(items).toHaveLength(1);
    expect(hasMore).toBe(false);
  });
});

// The same accent fix as `modules/clients/queries.test.ts`, plus the one
// thing an animal has that a client does not: an owner in another table.
describe("searching for an animal, or for whose animal it is", () => {
  it("folds the term and asks both keys", async () => {
    await listPets({ clinicId: "clinic-1", search: "Karabaş" });

    // The animal's own fields are generated into its `searchKey`; the
    // owner's name cannot be, because a generated column cannot read
    // another table -- and copying the name in would go stale the day
    // somebody marries. So the owner is reached through the client's
    // own key.
    expect(whereOf().OR).toEqual([
      { searchKey: { contains: "karabas" } },
      { owner: { searchKey: { contains: "karabas" } } },
    ]);
  });

  it("narrows to one owner's animals when the form already knows the owner", async () => {
    // A form that has asked whose animal this is must not answer with
    // somebody else's. Without this the animal picker on such a form
    // could not search at all: any search would widen the list straight
    // back to the whole clinic, so the owner's 51st animal was
    // unreachable -- the cap defect, one step further in.
    await quickSearchPets("clinic-1", "Karabaş", 20, "c-7");

    expect(whereOf().ownerId).toBe("c-7");
  });

  it("spans the clinic when no owner was given", async () => {
    // The other half, and the reason the parameter is optional: on a
    // visit or an appointment the animal is the first question asked.
    await quickSearchPets("clinic-1", "Karabaş", 20);

    expect(whereOf()).not.toHaveProperty("ownerId");
  });
});

// The screen must not offer what the server will refuse.
//
// `createReminder` rejects an animal that has died
// (`error.validation.petSilenced`), and the reminder form's picker was
// listing them: choose one, fill the form, submit, and the answer comes
// back on the animal field with nothing the vet can do about it. Not a
// data defect -- the sweep filters dead animals too -- a person walked
// into a dead end.
describe("animals a picker may offer", () => {
  it("leaves out the dead ones when the caller says so", async () => {
    await listPets({ clinicId: "clinic-1", excludeDeceased: true });

    expect(whereOf().deceased).toBe(false);
  });

  it("keeps them by default, because most callers need them", async () => {
    // A visit is routinely written up for an animal that died during
    // it, and its appointments stay on the record. A global filter
    // would have made those unreachable to fix the reminder form --
    // "this animal is gone" is true for one purpose and false for the
    // next.
    await listPets({ clinicId: "clinic-1" });

    expect(whereOf()).not.toHaveProperty("deceased");
  });
});
