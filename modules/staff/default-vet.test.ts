import { describe, expect, it } from "vitest";
import { defaultVetFor } from "./default-vet";

/**
 * Who a new visit or appointment opens with.
 *
 * The case worth the test is the one that is expensive to look at: a
 * receptionist's screen. pm cannot measure it without a second account,
 * and the defect it guards against is the one this product already
 * shipped once -- `vetId || ctx.userId` in the service, which recorded
 * whoever TYPED the form as the clinician who performed the work, in a
 * field nobody goes back to correct.
 *
 * So the rule is stated where it can be checked for free: only somebody
 * the clinic recognises as a clinician is offered as the default, and
 * everyone else opens on "not recorded" -- which is a true answer, and
 * a better one than a name nobody chose.
 */
describe("the veterinarian a new record opens with", () => {
  const clinicians = [
    { id: "vet-1" },
    { id: "vet-2" },
  ];

  it("is the signed-in user when the clinic recognises them as one", () => {
    expect(defaultVetFor(clinicians, "vet-2")).toBe("vet-2");
  });

  // A receptionist, a vet tech, a deactivated account, somebody from
  // another clinic: `listClinicians` answers all four questions at once
  // by not returning them.
  it("is nobody for a reader who may not be recorded as one", () => {
    expect(defaultVetFor(clinicians, "reception-1")).toBeUndefined();
  });

  it("is nobody on a clinic with no clinicians at all", () => {
    expect(defaultVetFor([], "vet-1")).toBeUndefined();
  });
});
