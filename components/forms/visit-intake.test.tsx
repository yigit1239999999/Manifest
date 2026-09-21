// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/visits/actions", () => ({
  createVisitAction: async () => ({}),
  createVisitIntakeAction: async () => ({}),
  updateVisitAction: async () => ({}),
}));
vi.mock("@/modules/pets/actions", () => ({
  searchPetsAction: async () => ({ options: [], hasMore: false }),
}));

import { VisitForm } from "@/components/forms/visit-form";

const VETS = [
  { id: "u-1", name: "Selin Aydın" },
  { id: "u-2", name: "Deniz Arslan" },
];

const PETS = [
  {
    id: "p-1",
    name: "Zeytin",
    ownerName: "Ayşe Yılmaz",
    speciesLabel: "Kedi",
    lastSeen: "7 ay önce",
  },
];

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );

/**
 * Who performed the examination, answered before the form opens.
 *
 * The service used to answer it with `vetId || ctx.userId`, and that was
 * removed for a reason that still holds: it recorded whoever typed the
 * form, so a receptionist writing up a visit became the clinician who
 * performed it, in a field nobody ever goes back to correct.
 *
 * What was wrong there was the guessing, not the answer. A vet filling
 * in their own examination is the ordinary case; the honest place to say
 * so is the screen, where the name is visible and one click away from
 * being changed. So the default is the PAGE's, and it is only ever the
 * signed-in user when the page has established they are somebody a visit
 * may be recorded against.
 */
describe("the veterinarian a new visit opens with", () => {
  it("is the signed-in clinician, said by name and marked as theirs", () => {
    wrap(<VisitForm pets={PETS} vets={VETS} defaultVetId="u-1" />);

    const select = screen.getByLabelText(/veteriner/i) as HTMLSelectElement;

    expect(select.value).toBe("u-1");
    expect(screen.getByRole("option", { name: "Selin Aydın (siz)" })).toBeTruthy();
    // Only the reader is marked. Every other clinician is a name.
    expect(screen.getByRole("option", { name: "Deniz Arslan" })).toBeTruthy();
  });

  // "Not recorded" is a real answer and a better one than a name nobody
  // chose -- which is exactly what a receptionist's own name would be.
  it("is left unrecorded for somebody who may not be recorded as one", () => {
    wrap(<VisitForm pets={PETS} vets={VETS} />);

    expect((screen.getByLabelText(/veteriner/i) as HTMLSelectElement).value).toBe(
      "",
    );
  });

  it("is whoever the record already says, when one is being edited", () => {
    const visit = {
      id: "v-1",
      petId: "p-1",
      vetId: "u-2",
      type: "WELLNESS_CHECK",
      visitedAt: new Date("2026-09-21T10:00:00Z"),
    } as never;

    wrap(<VisitForm visit={visit} pets={PETS} vets={VETS} defaultVetId="u-1" />);

    expect((screen.getByLabelText(/veteriner/i) as HTMLSelectElement).value).toBe(
      "u-2",
    );
  });
});
