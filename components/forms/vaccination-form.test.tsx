// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/vaccinations/actions", () => ({
  createVaccinationAction: async () => ({}),
}));

import { VaccinationForm } from "@/components/forms/vaccination-form";
import { clinicVaccineList } from "@/modules/vaccinations/catalogue";
import { normalizeVaccineSettings } from "@/modules/vaccinations/catalogue";

/**
 * What the form WRITES, not what it draws.
 *
 * Every number on this screen is a proposal: the next date, which dose of
 * the series, and where the interval came from. Proposals are the failure
 * mode that cost us a day on the import screen -- a line the vet agreed
 * with by not touching it arrived at the server as nothing, and the server
 * wrote a default in its place. The assertions here therefore read the
 * form's own FormData after touching only what a vet would touch.
 *
 * It is also the one place the CLINIC/LIST distinction can be checked. The
 * two say different sentences on screen, and if they collapsed into one
 * value on the way to the record, no later read could tell a clinic's own
 * interval from ours.
 */
const OFFERS = clinicVaccineList("DOG", normalizeVaccineSettings(undefined));

function mount(props: Partial<Parameters<typeof VaccinationForm>[0]> = {}) {
  const view = render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      <VaccinationForm petId="p-1" offers={OFFERS} {...props} />
    </NextIntlClientProvider>,
  );
  const form = view.container.querySelector("form");
  if (!form) throw new Error("no form");
  return {
    ...view,
    form,
    data: () => Object.fromEntries(new FormData(form).entries()),
  };
}

/** The two fields a vet fills in before anything is proposed to them. */
function fill(name: string, administered = "2026-09-23T10:00") {
  fireEvent.change(screen.getByLabelText(/^Aşı/), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/^Uygulanma tarihi/), {
    target: { value: administered },
  });
}

describe("vaccination form", () => {
  it("writes the dose and the source nobody touched", () => {
    const view = mount();
    fill("Karma");

    expect(screen.getByText("1 yıl, listeden geldi.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /1 yıl sonra/ }));

    const data = view.data();
    expect(data.nextDueSource).toBe("LIST");
    // The vet never touched the dose box; the number they were shown is
    // the number the record gets.
    expect(data.doseNumber).toBe("1");
    expect(data.seriesOf).toBe("3");
    expect(String(data.nextDueAt)).toContain("2027-09-2");
  });

  it("keeps the clinic's own interval apart from ours", () => {
    const offers = clinicVaccineList(
      "DOG",
      normalizeVaccineSettings({ intervals: { "dog.core": { unit: "year", value: 3 } } }),
    );
    const view = mount({ offers });
    fill("Karma");

    expect(screen.getByText("3 yıl, kliniğinizin ayarından geldi.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /3 yıl sonra/ }));
    expect(view.data().nextDueSource).toBe("CLINIC");
  });

  it("proposes nothing for the vaccine it will not date", () => {
    const view = mount();
    fill("Köpek öksürüğü");

    expect(screen.getByText(tr.vaccination.sourceAsk)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /sonra ·/ })).toBeNull();
    expect(view.data().nextDueSource).toBeUndefined();
    expect(view.data().nextDueAt).toBe("");
  });

  it("does not carry one vaccine's date onto another", () => {
    const view = mount();
    fill("Karma");
    fireEvent.click(screen.getByRole("button", { name: /1 yıl sonra/ }));
    expect(view.data().nextDueSource).toBe("LIST");

    fireEvent.change(screen.getByLabelText(/^Aşı/), { target: { value: "Kuduz" } });

    // Karma's date would otherwise still be in the field, labelled LIST,
    // on a Kuduz row -- a schedule nobody proposed for this vaccine.
    expect(view.data().nextDueAt).toBe("");
    expect(view.data().nextDueSource).toBeUndefined();
  });

  it("counts the dose the vet typed, not the one we proposed", () => {
    mount({ priorDoses: { "dog.core": 1 } });
    fill("Karma");

    expect(screen.getByText("Bu, bu hayvanın 3 dozluk serisindeki 2. dozu.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Kaçıncı doz/), { target: { value: "3" } });
    expect(screen.getByText("Bu, bu hayvanın 3 dozluk serisindeki 3. dozu.")).toBeTruthy();
  });
});
