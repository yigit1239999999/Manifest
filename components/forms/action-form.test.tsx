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
vi.mock("@/modules/pets/actions", () => ({
  searchPetsAction: async () => ({ options: [], hasMore: false }),
}));

import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";
import { ActionForm, useActionForm } from "@/components/forms/action-form";
import { VisitForm } from "@/components/forms/visit-form";

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

  it("goes to the submit button when nothing is left to fill", () => {
    wrap(<ActionFormWithAll />);

    expect(document.activeElement?.textContent).toBe("save");
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

describe("the last step of the chain, on the real form", () => {
  // The synthetic harness above fixes the rule; this fixes the wiring.
  // Coming back from /pets/new the animal is chosen, the visit type and
  // the date carry defaults, so nothing required is empty and the work
  // left is to submit. What must not happen is the cursor landing in
  // the animal picker, whose value the chain just wrote.
  it("does not land in the animal the chain just chose", () => {
    wrap(
      <VisitForm
          pets={[{ id: "p-1", name: "Zeytin", ownerName: "Ayşe Yılmaz" }]}
        vets={[{ id: "u-1", name: "Dr. Ayşe Demir" }]}
        defaultPetId="p-1"
        defaultPetLabel="Zeytin · Ayşe Yılmaz"
      />,
    );

    expect(document.activeElement?.getAttribute("role")).not.toBe("combobox");
    expect(document.activeElement?.tagName).toBe("BUTTON");
  });
});
