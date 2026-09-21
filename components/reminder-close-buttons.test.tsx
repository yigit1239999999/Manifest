// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReminderCloseButtons } from "@/components/reminder-close-buttons";

// A reminder list is read one row at a time, and by voice it is read as a
// sequence of identical buttons: "Done", "Close", "Done", "Close". Which
// row you are on is carried entirely by where you happen to be in the
// list, which is exactly the thing a screen reader user does not have.
//
// So the visible label stays short — the row is dense — and the accessible
// name says which reminder it belongs to. The two are different strings on
// purpose, and that is the whole rule (TEAM.md #26).

const noop = vi.fn(async () => undefined);

function rowFor(title: string) {
  return render(
    <ReminderCloseButtons
      acknowledge={noop}
      dismiss={noop}
      acknowledgeLabel="Tamam"
      dismissLabel="Kapat"
      acknowledgeName={`${title}: tamamlandı olarak işaretle`}
      dismissName={`${title}: gerek kalmadı`}
    />,
  );
}

describe("closing a reminder", () => {
  it("names each button by the reminder it belongs to", () => {
    rowFor("Pamuk — kuduz aşısı");

    expect(
      screen.getByRole("button", {
        name: "Pamuk — kuduz aşısı: tamamlandı olarak işaretle",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pamuk — kuduz aşısı: gerek kalmadı" }),
    ).toBeInTheDocument();
  });

  it("keeps the visible label short, which is why the name is separate", () => {
    const { container } = rowFor("Pamuk — kuduz aşısı");
    const buttons = [...container.querySelectorAll("button")];

    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      "Tamam",
      "Kapat",
    ]);
    // If these two ever became the same string, the rule would have been
    // satisfied by shortening the name rather than by naming the row.
    for (const button of buttons) {
      expect(button.getAttribute("aria-label")).not.toBe(button.textContent);
    }
  });

  it("gives two rows two different pairs of names", () => {
    // The failure this prevents is not "no name" but "same name twice",
    // which reads as correct in a single-row test.
    rowFor("Pamuk — kuduz aşısı");
    rowFor("Zeytin — dikiş kontrolü");

    const names = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"));
    expect(new Set(names).size).toBe(names.length);
  });

  it("submits each action from its own form, so one pending state is one button", () => {
    // Also what keeps a row closable with JavaScript off.
    const { container } = rowFor("Pamuk — kuduz aşısı");
    expect(container.querySelectorAll("form")).toHaveLength(2);
  });

  it("asks nothing first, on purpose", () => {
    // Neither action destroys anything, both are visible under the
    // "Closed" filter afterwards, and both are undone by changing the
    // status again. A confirmation here charges twice for a reversible
    // act (TEAM.md #25) — the same reasoning as `RestoreButton`.
    const { container } = rowFor("Pamuk — kuduz aşısı");
    expect(container.querySelector("dialog")).toBeNull();
  });
});
