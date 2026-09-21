// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

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

// What the vet measured on the shipping product: a chief complaint and
// a history typed into a visit, a walk to the client list, and both
// fields empty on the way back -- with no warning on the way out. Their
// own scale for it: "a door annoys me, a lost note takes me off the
// program, and I pick up paper".
describe("a visit left half-written", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    // Who the drafts belong to; the app layout writes this on <main>.
    document.body.innerHTML = '<main data-draft-scope="u-1"></main>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
    window.sessionStorage.clear();
  });

  const visit = (extra: { defaultPetId?: string; defaultPetLabel?: string } = {}) => (
    <NextIntlClientProvider locale="tr" messages={tr}>
      <VisitForm
        pets={[{ id: "p-1", name: "Zeytin", ownerName: "Ayşe Yılmaz" }]}
        vets={[{ id: "u-1", name: "Dr. Ayşe Demir" }]}
        {...extra}
      />
    </NextIntlClientProvider>
  );

  /**
   * A fresh container under the scoped <main> for each mount, because
   * leaving and returning is two mounts and React will not reuse a root
   * it has unmounted.
   */
  const mount = (ui: React.ReactNode) => {
    const container = document.createElement("div");
    document.body.querySelector("main")!.appendChild(container);
    return render(ui, { container });
  };

  const complaint = () =>
    document.querySelector<HTMLTextAreaElement>('[name="chiefComplaint"]')!;

  it("still has what was typed when the vet comes back", () => {
    const first = mount(visit());
    fireEvent.input(complaint(), { target: { value: "Zeytin kusuyor" } });
    // The client list, a phone call, anything: the form unmounts.
    first.unmount();

    mount(visit());

    expect(complaint().value).toBe("Zeytin kusuyor");
  });

  // Said once, quietly, to somebody who has just arrived and might
  // otherwise wonder why a form they left is full.
  it("says so, rather than filling itself in silence", () => {
    const first = mount(visit());
    fireEvent.input(complaint(), { target: { value: "Zeytin kusuyor" } });
    first.unmount();

    mount(visit());

    expect(screen.getByText(tr.common.draftRestored)).toBeTruthy();
  });

  it("says nothing on a form nobody had typed into", () => {
    mount(visit());

    expect(screen.queryByText(tr.common.draftRestored)).toBeNull();
  });

  // The draft is older than the URL that reopened the form. Coming back
  // from the animal chain the picker arrives filled with the animal
  // just created, while the draft remembers it empty -- and writing the
  // emptier of the two back would undo the walk the vet just made.
  it("does not undo the animal the chain just added", () => {
    const first = mount(visit());
    fireEvent.input(complaint(), { target: { value: "Zeytin kusuyor" } });
    first.unmount();

    mount(visit({ defaultPetId: "p-1", defaultPetLabel: "Zeytin · Ayşe Yılmaz" }));

    expect(
      document.querySelector<HTMLInputElement>('input[name="petId"]')!.value,
    ).toBe("p-1");
    expect(complaint().value).toBe("Zeytin kusuyor");
  });

  // Focus looks for the first field still empty, and a field the draft
  // is about to fill is not empty. If the order ever flips, the cursor
  // lands in the restored complaint and the vet types into the middle
  // of their own sentence.
  it("puts the cursor past what was restored", () => {
    const first = mount(visit());
    fireEvent.input(complaint(), { target: { value: "Zeytin kusuyor" } });
    first.unmount();

    mount(visit({ defaultPetId: "p-1", defaultPetLabel: "Zeytin · Ayşe Yılmaz" }));

    expect((document.activeElement as HTMLElement).getAttribute("name")).not.toBe(
      "chiefComplaint",
    );
  });
});

/** A form whose action resolves, so the submit can be watched. */
function Saves({ onSubmit }: { onSubmit: () => void }) {
  const form = useActionForm(async () => {
    onSubmit();
    return {};
  }, {});
  return (
    <ActionForm form={form} draftKey="visit:new">
      <textarea name="chiefComplaint" defaultValue="" />
      <button type="submit">save</button>
    </ActionForm>
  );
}

describe("a visit that does get saved", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    document.body.innerHTML = '<main data-draft-scope="u-1"></main>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
    window.sessionStorage.clear();
  });

  // The successful case usually never reports a success: creating a
  // visit redirects and this component is gone. So the draft is dropped
  // when the submit starts, or a saved visit would be handed to the
  // next one as unsaved work.
  it("does not haunt the next visit with what it saved", async () => {
    const container = document.createElement("div");
    document.body.querySelector("main")!.appendChild(container);
    const saved = vi.fn();
    render(
      <NextIntlClientProvider locale="tr" messages={tr}>
        <Saves onSubmit={saved} />
      </NextIntlClientProvider>,
      { container },
    );

    const field = container.querySelector("textarea")!;
    fireEvent.input(field, { target: { value: "Zeytin kusuyor" } });
    expect(window.sessionStorage.length).toBe(1);

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });

    expect(saved).toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });
});
