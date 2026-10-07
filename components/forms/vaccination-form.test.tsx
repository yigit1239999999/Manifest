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
  it("fills in the list's date as soon as the vaccine is chosen, and says so", () => {
    const view = mount();
    fill("Kuduz");

    // pm (B8): the date used to arrive only after pressing save.
    expect(screen.getByText(/Önerilen tarih yazıldı/)).toBeTruthy();
    expect(screen.getByText(/1 yıl, listeden geldi\./)).toBeTruthy();
    const data = view.data();
    expect(data.nextDueSource).toBe("LIST");
    expect(String(data.nextDueAt)).toContain("2027-09-23");
  });

  it("writes the dose and the source nobody touched, for a puppy", () => {
    const view = mount({ birthDate: "2026-07-29" });
    fill("Karma");

    const data = view.data();
    expect(data.nextDueSource).toBe("LIST");
    // The vet never touched the dose box; the number they were shown is
    // the number the record gets.
    expect(data.doseNumber).toBe("1");
    expect(data.seriesOf).toBe("3");
    // Mid-series the next date is the next dose, three weeks on, not a
    // year: 23 Sep + 3 weeks.
    expect(String(data.nextDueAt)).toContain("2026-10-14");
    expect(screen.getByText(/Serinin 2\. dozu için 3 hafta, listeden geldi\./)).toBeTruthy();
  });

  it("does not offer an adult's booster as the first dose of a series", () => {
    // The vet's screenshot: "1 yıl, listeden geldi" and "3 dozluk serinin
    // 1. dozu, dozlar arası 3-4 hafta" on the same adult dog.
    const view = mount({ birthDate: "2022-01-01", priorDoses: { "dog.core": 1 } });
    fill("Karma");

    expect(screen.getByText(/1 yıl, listeden geldi\./)).toBeTruthy();
    expect(screen.queryByText(/dozluk/)).toBeNull();
    expect(screen.queryByLabelText(/^Kaçıncı doz/)).toBeNull();
    expect(view.data().doseNumber).toBeUndefined();
    expect(String(view.data().nextDueAt)).toContain("2027-09-23");
  });

  it("reads the age on the day of the dose, not today", () => {
    // Born in March: a puppy on 1 June, whenever the dose is written up.
    mount({ birthDate: "2026-03-20" });
    fill("Karma", "2026-06-01T10:00");
    expect(screen.getByText(/dozluk başlangıç serisi/)).toBeTruthy();
  });

  it("assumes no puppy series when the birth date is unknown", () => {
    mount({ birthDate: null });
    fill("Karma");
    expect(screen.queryByText(/dozluk/)).toBeNull();
  });

  it("continues a series the record says is unfinished, whatever the age", () => {
    const view = mount({ birthDate: null, openSeries: { "dog.core": { dose: 1, of: 3 } } });
    fill("Karma");
    expect(screen.getByText("Bu, bu hayvanın 3 dozluk serisindeki 2. dozu.")).toBeTruthy();
    expect(view.data().doseNumber).toBe("2");
  });

  it("keeps the clinic's own interval apart from ours", () => {
    const offers = clinicVaccineList(
      "DOG",
      normalizeVaccineSettings({ intervals: { "dog.core": { unit: "year", value: 3 } } }),
    );
    const view = mount({ offers });
    fill("Karma");

    expect(screen.getByText(/3 yıl, kliniğinizin ayarından geldi\./)).toBeTruthy();
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
    expect(view.data().nextDueSource).toBe("LIST");

    fireEvent.change(screen.getByLabelText(/^Aşı/), { target: { value: "Köpek öksürüğü" } });

    // Karma's date would otherwise still be in the field, labelled LIST,
    // on a row the list proposes no date for.
    expect(view.data().nextDueAt).toBe("");
    expect(view.data().nextDueSource).toBeUndefined();
  });

  it("keeps a date the vet typed, as theirs", () => {
    const view = mount();
    fill("Kuduz");
    fireEvent.change(screen.getByLabelText(/^Sonraki/), { target: { value: "2027-01-05" } });
    expect(view.data().nextDueSource).toBe("MANUAL");
    expect(screen.getByRole("button", { name: /1 yıl sonra/ })).toBeTruthy();

    // And the chip takes it back to the list's proposal.
    fireEvent.click(screen.getByRole("button", { name: /1 yıl sonra/ }));
    expect(view.data().nextDueSource).toBe("LIST");
  });

  it("counts the dose the vet typed, not the one we proposed", () => {
    mount({ birthDate: "2026-07-15", priorDoses: { "dog.core": 1 } });
    fill("Karma");

    expect(screen.getByText("Bu, bu hayvanın 3 dozluk serisindeki 2. dozu.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Kaçıncı doz/), { target: { value: "3" } });
    expect(screen.getByText("Bu, bu hayvanın 3 dozluk serisindeki 3. dozu.")).toBeTruthy();
    // The last dose of the series is followed by the yearly booster.
    expect(screen.getByText(/1 yıl, listeden geldi\./)).toBeTruthy();
  });
});
