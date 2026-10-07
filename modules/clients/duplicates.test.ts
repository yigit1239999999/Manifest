import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { client: { findMany: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import { comparableDigits, findDuplicateClients } from "./duplicates";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.client.findMany).mockResolvedValue([] as never);
});

const whereOf = () => vi.mocked(prisma.client.findMany).mock.calls[0][0]?.where;

describe("comparableDigits", () => {
  it("is the stored column's rule: digits, the last ten", () => {
    expect(comparableDigits("+90 (532) 411-22-33")).toBe("5324112233");
    expect(comparableDigits("0532 411 22 33")).toBe("5324112233");
    expect(comparableDigits("212 55")).toBeNull();
  });
});

describe("findDuplicateClients", () => {
  it("asks for the number as a whole value of either phone, in this clinic", async () => {
    await findDuplicateClients("clinic-1", { phone: "0532-411-22-33", excludeId: "c-self" });
    expect(whereOf()).toEqual({
      clinicId: "clinic-1",
      id: { not: "c-self" },
      OR: [
        { phoneDigits: "5324112233" },
        { phoneDigits: { startsWith: "5324112233 " } },
        { phoneDigits: { endsWith: " 5324112233" } },
      ],
    });
  });

  it("matches an e-mail regardless of case", async () => {
    await findDuplicateClients("clinic-1", { email: " Ayse@Ornek.com " });
    expect(whereOf()?.OR).toEqual([{ email: { equals: "ayse@ornek.com", mode: "insensitive" } }]);
  });

  it("does not ask at all with nothing to compare", async () => {
    expect(await findDuplicateClients("clinic-1", { phone: "", email: "" })).toEqual([]);
    expect(prisma.client.findMany).not.toHaveBeenCalled();
  });

  it("says which value matched", async () => {
    vi.mocked(prisma.client.findMany).mockResolvedValue([
      {
        id: "c-1",
        firstName: "Ayşe",
        lastName: "Tekin",
        phone: "0532 411 22 33",
        email: "x@y.z",
        phoneDigits: "5551112233 5324112233",
        archivedAt: null,
        pets: [{ name: "Fındık" }],
      },
    ] as never);
    const [hit] = await findDuplicateClients("clinic-1", { phone: "05324112233", email: "a@b.c" });
    expect(hit.matchedOn).toEqual(["phone"]);
    expect(hit).not.toHaveProperty("phoneDigits");
  });
});
