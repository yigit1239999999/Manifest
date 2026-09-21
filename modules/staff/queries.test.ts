import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findMany: vi.fn(), findFirst: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { CLINICIAN_ROLES, isClinician, listClinicians } from "./queries";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);
});

// Who may be recorded as the vet on a visit or an appointment.
//
// The four screens offering the choice listed every active user, so a
// receptionist could be saved as the clinician who treated an animal —
// and that is a field nobody goes back to correct. The fix was one source
// read by both the screens and the services, so the two cannot answer
// differently; these tests are about the question that source asks.
//
// Asserted on the `where` rather than through the services, because the
// service tests mock this call and would pass whatever it asked. Checking
// the service calls it is not the same as checking it asks the right
// thing: removing the role filter left every service test green.
describe("who counts as a clinician", () => {
  it("is veterinarians and administrators, and the reason is the role model", () => {
    // A user carries exactly one role, so the owner-vet of a single-vet
    // clinic is the ADMIN and cannot also be a VETERINARIAN. Leaving ADMIN
    // out would leave that clinic with nobody to choose.
    expect([...CLINICIAN_ROLES]).toEqual(["VETERINARIAN", "ADMIN"]);
  });

  it("offers only active clinicians of that clinic", async () => {
    await listClinicians("clinic-1");

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clinicId: "clinic-1",
          active: true,
          role: { in: [...CLINICIAN_ROLES] },
        },
      }),
    );
  });

  it("asks all four questions at once when checking one", async () => {
    // Right person, wrong clinic; right clinic, deactivated; right clinic,
    // active, receptionist — every one of them has to come back false, and
    // one `where` answers all of them.
    await isClinician("clinic-1", "u-1");

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "u-1",
          clinicId: "clinic-1",
          active: true,
          role: { in: [...CLINICIAN_ROLES] },
        },
      }),
    );
  });

  it("says no when nothing matches", async () => {
    await expect(isClinician("clinic-1", "reception-1")).resolves.toBe(false);
  });

  it("says yes when something does", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "vet-1" } as never);

    await expect(isClinician("clinic-1", "vet-1")).resolves.toBe(true);
  });
});
