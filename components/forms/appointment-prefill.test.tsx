// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";
import { ClinicZoneProvider } from "@/components/clinic-zone";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/appointments/actions", () => ({
  createAppointmentAction: async () => ({}),
  updateAppointmentAction: async () => ({}),
}));
vi.mock("@/modules/pets/actions", () => ({
  searchPetsAction: async () => [],
}));

import { AppointmentForm } from "@/components/forms/appointment-form";

// "Book" from an overdue vaccination or a reminder used to open a blank
// general check-up an hour from now. The page works out what the link
// was about (`modules/appointments/prefill.ts`); this is the half where
// the form actually shows it.

const PETS = [{ id: "p-1", name: "Zeytin", ownerName: "Ayşe Yılmaz" }];
const VETS = [{ id: "u-1", name: "Dr. Ayşe Demir" }];

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      <ClinicZoneProvider timeZone="Europe/Istanbul">{ui}</ClinicZoneProvider>
    </NextIntlClientProvider>,
  );

const field = (container: HTMLElement, selector: string) =>
  container.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value;

describe("a new appointment opened from a link", () => {
  it("opens on the type, reason and start the link carried", () => {
    const { container } = wrap(
      <AppointmentForm
        pets={PETS}
        vets={VETS}
        defaultPetId="p-1"
        defaultType="VACCINATION"
        defaultReason="Kuduz"
        defaultStartsAt={new Date("2026-10-12T06:00:00Z")}
      />,
    );

    expect(field(container, 'select[name="type"]')).toBe("VACCINATION");
    expect(field(container, 'input[name="reason"]')).toBe("Kuduz");
    // 09:00 on the clinic's clock, and the instant it stands for.
    expect(field(container, 'input[type="datetime-local"]')).toBe("2026-10-12T09:00");
    expect(field(container, 'input[type="hidden"][name="startsAt"]')).toBe(
      "2026-10-12T06:00:00.000Z",
    );
  });

  it("lets an existing appointment win over the link", () => {
    const { container } = wrap(
      <AppointmentForm
        appointment={
          {
            id: "a-1",
            petId: "p-1",
            type: "SURGERY",
            reason: "Kısırlaştırma",
            status: "SCHEDULED",
            startsAt: new Date("2026-10-20T08:30:00Z"),
          } as never
        }
        pets={PETS}
        vets={VETS}
        defaultType="VACCINATION"
        defaultReason="Kuduz"
        defaultStartsAt={new Date("2026-10-12T06:00:00Z")}
      />,
    );

    expect(field(container, 'select[name="type"]')).toBe("SURGERY");
    expect(field(container, 'input[name="reason"]')).toBe("Kısırlaştırma");
    expect(field(container, 'input[type="hidden"][name="startsAt"]')).toBe(
      "2026-10-20T08:30:00.000Z",
    );
  });
});
