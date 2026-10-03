// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/visits/actions", () => ({
  createVisitIntakeAction: async () => ({}),
  updateVisitAction: async () => ({}),
}));
vi.mock("@/modules/appointments/actions", () => ({
  createAppointmentAction: async () => ({}),
  updateAppointmentAction: async () => ({}),
}));
vi.mock("@/modules/clients/actions", () => ({
  searchClientsAction: async () => ({ options: [], hasMore: false }),
}));
vi.mock("@/modules/pets/actions", () => ({
  searchPetsAction: async () => ({ options: [], hasMore: false }),
}));

import { VisitForm } from "@/components/forms/visit-form";
import { AppointmentForm } from "@/components/forms/appointment-form";

// A clinic with several animals of the same name is the ordinary case, not
// the edge one: the vet this was written for keeps three Zeytins and four
// Pamuks. Until this test existed, both of these pickers listed them as
// "Zeytin", "Zeytin", "Zeytin" -- three rows a vet cannot choose between,
// in the two forms that write into an animal's record. They named that as
// the thing they are most afraid of, and they were describing this list.
//
// The assertion is deliberately about what the *rows* say rather than
// about `petLabel` returning a string, because the defect was never in the
// format. It was in four call sites that had the owner loaded and dropped
// it on the way to the picker, while two others kept it -- so the product
// disagreed with itself inside one dropdown.

const VETS = [{ id: "u-1", name: "Dr. Ayşe Demir" }];

const TWO_ZEYTINS = [
  {
    id: "p-1",
    name: "Zeytin",
    ownerId: "c-1",
    ownerName: "Ayşe Yılmaz",
    speciesLabel: "Kedi",
    lastSeen: "7 ay önce",
  },
  {
    id: "p-2",
    name: "Zeytin",
    ownerId: "c-2",
    ownerName: "Mehmet Kaya",
    speciesLabel: "Köpek",
    lastSeen: "2 gün önce",
  },
];

// The row grew a second line after this test was written, and the
// question it asks did not change: two animals with one name are told
// apart by their owner. What moved is where the owner is said -- under
// the name rather than after it, beside the last visit -- because the
// vet is looking at the animal while they choose and asked for the
// species next to the name: "I can see with my own eyes whether it is a
// cat or a dog". `textContent` runs the two lines together, which is
// why these read without a separator.

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );

/**
 * The rows the picker offers, as the vet reads them.
 *
 * Scoped to this combobox's own listbox rather than every `option` on the
 * page: the same form carries native `<select>`s for the visit type and
 * the vet, and their options answer to the same role.
 */
const rows = (name: RegExp) => {
  const input = screen.getByRole("combobox", { name });
  fireEvent.focus(input);
  const listId = input.getAttribute("aria-controls")!;
  return Array.from(
    document.getElementById(listId)!.querySelectorAll('[role="option"]'),
  ).map((o) => o.textContent);
};

describe("two animals with the same name", () => {
  it("are told apart by their owner when a visit is written", () => {
    wrap(<VisitForm pets={TWO_ZEYTINS} vets={VETS} />);

    expect(rows(/hayvan/i)).toEqual([
      "Zeytin · KediAyşe Yılmaz · 7 ay önce",
      "Zeytin · KöpekMehmet Kaya · 2 gün önce",
    ]);
  });

  it("are told apart by their owner when an appointment is booked", () => {
    wrap(<AppointmentForm pets={TWO_ZEYTINS} vets={VETS} />);

    expect(rows(/hayvan/i)).toEqual([
      "Zeytin · KediAyşe Yılmaz · 7 ay önce",
      "Zeytin · KöpekMehmet Kaya · 2 gün önce",
    ]);
  });
});
