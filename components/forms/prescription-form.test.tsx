// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/prescriptions/actions", () => ({
  createPrescriptionAction: async () => ({}),
}));

import { PrescriptionForm } from "@/components/forms/prescription-form";

function mount(alerts: string | null) {
  return render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      <PrescriptionForm petId="p-1" alerts={alerts} />
    </NextIntlClientProvider>,
  );
}

function typeDrug(name: string) {
  fireEvent.change(screen.getByLabelText(/^İlaç/), { target: { value: name } });
}

describe("prescription form allergy warning", () => {
  it("names the allergy and the drug as it is typed, and asks for a reason", () => {
    const view = mount("AMOKSİSİLİN ALERJİSİ");
    typeDrug("Amoksisilin + Klavulanik asit");

    const box = view.container.querySelector("[data-allergy-conflict]");
    expect(box).not.toBeNull();
    expect(box).toHaveTextContent("AMOKSİSİLİN ALERJİSİ");
    expect(box).toHaveTextContent("Amoksisilin + Klavulanik asit");
    const reason = screen.getByLabelText(/^Yine de yaz: gerekçe/);
    expect(reason).toBeRequired();
    expect(screen.getByRole("button", { name: "Yine de yaz" })).toBeInTheDocument();
  });

  it("says why two different names collided", () => {
    const view = mount("Penisilin alerjisi");
    typeDrug("Ampisilin");
    expect(view.container.querySelector("[data-allergy-conflict]")).toHaveTextContent(
      "penisilin grubu",
    );
  });

  it("stays out of the way for a drug that matches nothing", () => {
    const view = mount("Penisilin alerjisi");
    typeDrug("Meloksikam");
    expect(view.container.querySelector("[data-allergy-conflict]")).toBeNull();
    expect(screen.queryByLabelText(/^Yine de yaz/)).toBeNull();
    expect(screen.getByRole("button", { name: "Reçeteyi kaydet" })).toBeInTheDocument();
  });
});
