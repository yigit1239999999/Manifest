// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/treatments/actions", () => ({
  createTreatmentAction: async () => ({ success: true }),
}));
vi.mock("@/modules/vaccinations/actions", () => ({
  createVaccinationAction: async () => ({ success: true }),
}));

import { TreatmentForm } from "@/components/forms/treatment-form";
import { VaccinationForm } from "@/components/forms/vaccination-form";

/**
 * pm found Badem with two "Lyme" at 08:40: after a save the picker still
 * showed the name, so the next press saved it again. `form.reset()`
 * cleared what the DOM owns; the combobox keeps its own state. The
 * <ActionForm> now remounts its fields on reset, which these check from
 * the outside: after a save, the name box is empty.
 */
async function saveWith(container: HTMLElement, label: RegExp, name: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value: name } });
  expect(input.value).toBe(name);
  const form = container.querySelector("form")!;
  await act(async () => {
    fireEvent.submit(form);
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("a clinical form after a save", () => {
  it("empties the treatment name", async () => {
    const view = render(
      <NextIntlClientProvider locale="tr" messages={tr}>
        <TreatmentForm petId="p-1" />
      </NextIntlClientProvider>,
    );
    await saveWith(view.container, /^Tedavi \/ işlem/, "Serum");
    expect((screen.getByLabelText(/^Tedavi \/ işlem/) as HTMLInputElement).value).toBe("");
  });

  it("empties the vaccine name", async () => {
    const view = render(
      <NextIntlClientProvider locale="tr" messages={tr}>
        <VaccinationForm petId="p-1" />
      </NextIntlClientProvider>,
    );
    await saveWith(view.container, /^Aşı/, "Lyme");
    expect((screen.getByLabelText(/^Aşı/) as HTMLInputElement).value).toBe("");
  });
});
