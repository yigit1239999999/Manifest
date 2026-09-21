// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/modules/visits/actions", () => ({
  createVisitAction: async () => ({}),
  updateVisitAction: async () => ({}),
}));
vi.mock("@/modules/clients/actions", () => ({
  searchClientsAction: async () => ({ options: [], hasMore: false }),
}));
vi.mock("@/modules/appointments/actions", () => ({
  createAppointmentAction: async () => ({}),
  updateAppointmentAction: async () => ({}),
}));
vi.mock("@/modules/invoices/actions", () => ({
  createInvoiceAction: async () => ({}),
  updateInvoiceAction: async () => ({}),
}));
vi.mock("@/modules/pets/actions", () => ({
  createPetAction: async () => ({}),
  updatePetAction: async () => ({}),
  searchPetsAction: async () => ({ options: [], hasMore: false }),
}));

import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";
import { ActionForm, useActionForm } from "@/components/forms/action-form";
import { VisitForm } from "@/components/forms/visit-form";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { PetForm } from "@/components/forms/pet-form";

/**
 * A form that arrives already part-filled -- the last step of the chain
 * a new clinic walks, or a deep link from a record's own page.
 *
 * The cursor belongs on the work that remains. Left at the top of the
 * document it hands the vet the job of finding where they resume, at
 * the end of a chain built to stop exactly that; put on a field the
 * chain just filled, it reads as an invitation to choose again, and
 * re-picking is how the wrong animal ends up attached to a visit.
 */
function Harness({ focus, filled }: { focus: boolean; filled: boolean }) {
  const form = useActionForm(async () => ({}), {});
  return (
    <ActionForm form={form} focusFirstEmpty={focus}>
      <input name="petId" required defaultValue={filled ? "Zeytin · Ayşe" : ""} />
      <input name="reason" required defaultValue="" />
      <input name="notes" defaultValue="" />
      <button type="submit">save</button>
    </ActionForm>
  );
}

const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );

describe("where the cursor lands on a part-filled form", () => {
  it("goes to the first field still needing an answer", () => {
    wrap(<Harness focus filled />);

    // Not the animal, which the chain just filled: focus there invites
    // a second choice nobody asked for.
    expect((document.activeElement as HTMLInputElement).name).toBe("reason");
  });

  it("goes to the first required field when nothing is filled", () => {
    wrap(<Harness focus filled={false} />);

    expect((document.activeElement as HTMLInputElement).name).toBe("petId");
  });

  it("goes to an optional field rather than past it to submit", () => {
    // The visit type and the date arrive with defaults nobody chose, so
    // a form whose required fields are all "answered" can still have the
    // reason for the visit blank. A default is not an answer.
    wrap(<Defaulted />);

    expect((document.activeElement as HTMLInputElement).name).toBe("notes");
  });

  it("goes to the submit button only when nothing at all is blank", () => {
    wrap(<ActionFormWithAll />);

    expect(document.activeElement?.textContent).toBe("save");
  });

  it("does not count a select showing 'none' as blank", () => {
    // A select always displays a chosen option, and "none" is an answer
    // on the screen; an empty box shows nothing. So the vet select on
    // the visit form is stepped over, not landed in.
    wrap(<Defaulted />);

    expect(document.activeElement?.tagName).toBe("INPUT");
  });

  it("stays out of the way when the form was opened deliberately", () => {
    // Most forms are opened by somebody already looking at them, and a
    // page that grabs focus on load moves the screen and opens a
    // keyboard for nothing.
    wrap(<Harness focus={false} filled />);

    expect(document.activeElement).toBe(document.body);
  });
});

function ActionFormWithAll() {
  const form = useActionForm(async () => ({}), {});
  return (
    <ActionForm form={form} focusFirstEmpty>
      <input name="petId" required defaultValue="Zeytin" />
      <input name="reason" required defaultValue="kontrol" />
      <button type="submit">save</button>
    </ActionForm>
  );
}

// The synthetic harness above fixes the rule; these fix the wiring, one
// per prefillable form. Where each one actually lands was measured
// rather than reasoned about: "reasonable" and "measured" disagreed
// about the visit form once already, and that disagreement was the
// defect. Written down here so the four answers cannot drift quietly --
// nothing else in the app notices if a new default field appears above
// the one the cursor used to reach.
describe("the last step of the chain, on the real forms", () => {
  // Coming back from /pets/new the animal is chosen; the visit type and
  // the date carry defaults nobody picked, so the first thing genuinely
  // blank is the reason the vet is there.
  it("lands on the sentence the vet came to write", () => {
    wrap(
      <VisitForm
        pets={[{ id: "p-1", name: "Zeytin", ownerName: "Ayşe Yılmaz" }]}
        vets={[{ id: "u-1", name: "Dr. Ayşe Demir" }]}
        defaultPetId="p-1"
        defaultPetLabel="Zeytin · Ayşe Yılmaz"
      />,
    );

    expect(document.activeElement?.getAttribute("role")).not.toBe("combobox");
    expect((document.activeElement as HTMLTextAreaElement).name).toBe(
      "chiefComplaint",
    );
  });

  it("asks an appointment why the animal is coming in", () => {
    wrap(
      <AppointmentForm
        pets={[{ id: "p-1", name: "Zeytin", ownerName: "Ayşe Yılmaz" }]}
        vets={[{ id: "u-1", name: "Dr. Ayşe Demir" }]}
        defaultPetId="p-1"
        defaultPetLabel="Zeytin · Ayşe Yılmaz"
      />,
    );

    expect((document.activeElement as HTMLInputElement).name).toBe("reason");
  });

  it("puts a bill on its first line rather than its number", () => {
    // The number arrives filled (`defaultNumber`), which is the whole
    // point of the rule: a form can be part-filled from more than one
    // direction and the cursor still belongs on the first blank.
    wrap(
      <InvoiceForm
        clients={[{ id: "c-1", firstName: "Ayşe", lastName: "Yılmaz" }]}
        defaultClientId="c-1"
        defaultClientLabel="Ayşe Yılmaz"
        defaultNumber="2026-0001"
      />,
    );

    expect((document.activeElement as HTMLInputElement).name).toBe(
      "lines[0].description",
    );
  });

  it("asks a new animal for its name", () => {
    wrap(
      <PetForm
        owners={[{ id: "c-1", firstName: "Ayşe", lastName: "Yılmaz" }]}
        defaultOwnerId="c-1"
        defaultOwnerLabel="Ayşe Yılmaz"
      />,
    );

    expect((document.activeElement as HTMLInputElement).name).toBe("name");
  });
});

/** Required fields all "answered" by defaults, with the real work blank. */
function Defaulted() {
  const form = useActionForm(async () => ({}), {});
  return (
    <ActionForm form={form} focusFirstEmpty>
      <input name="petId" required defaultValue="Zeytin · Ayşe" />
      <input name="visitedAt" required defaultValue="2026-09-21T09:00" />
      <select name="vetId" defaultValue="">
        <option value="">none</option>
        <option value="u-1">Dr. Ayşe Demir</option>
      </select>
      <input name="notes" defaultValue="" />
      <button type="submit">save</button>
    </ActionForm>
  );
}
