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
      reopenLabel="Geri aç"
      acknowledgeName={`Tamam: ${title}`}
      dismissName={`Kapat: ${title}`}
      reopenName={`Geri aç: ${title}`}
    />,
  );
}

describe("closing a reminder", () => {
  it("names each button by the reminder it belongs to", () => {
    rowFor("Pamuk — kuduz aşısı");

    expect(
      screen.getByRole("button", { name: "Tamam: Pamuk — kuduz aşısı" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kapat: Pamuk — kuduz aşısı" }),
    ).toBeInTheDocument();
  });

  it("keeps the visible label short, and keeps it inside the name", () => {
    const { container } = rowFor("Pamuk — kuduz aşısı");
    const buttons = [...container.querySelectorAll("button")];

    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      "Tamam",
      "Kapat",
    ]);
    for (const button of buttons) {
      const name = button.getAttribute("aria-label")!;
      // Longer than the label, so the row is identified...
      expect(name).not.toBe(button.textContent);
      // ...and containing it, so someone driving by voice can still say
      // the word they can see. pm found "Kapat" missing from "gerek
      // kalmadı" — and found it by `getByRole` returning nothing, which
      // is the same trap waiting in any e2e test written against it.
      expect(name).toContain(button.textContent!.trim());
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

  it("offers the way back on a closed row, and only there", () => {
    // The reason there is no confirmation in front of the two buttons
    // above: a row closed by mistake can be reopened. Before this existed
    // that was true of the service and not of anyone using the app, which
    // is the same gap archiving had to close the expensive way.
    const open = render(
      <ReminderCloseButtons
        acknowledge={noop}
        dismiss={noop}
        acknowledgeLabel="Tamam"
        dismissLabel="Kapat"
        reopenLabel="Geri aç"
        acknowledgeName="a"
        dismissName="b"
        reopenName="c"
      />,
    );
    expect(open.container.querySelectorAll("form")).toHaveLength(2);
    expect(open.queryByRole("button", { name: "c" })).toBeNull();
    open.unmount();

    const closed = render(
      <ReminderCloseButtons
        reopen={noop}
        acknowledgeLabel="Tamam"
        dismissLabel="Kapat"
        reopenLabel="Geri aç"
        acknowledgeName="a"
        dismissName="b"
        reopenName="c"
      />,
    );
    expect(closed.container.querySelectorAll("form")).toHaveLength(1);
    expect(closed.getByRole("button", { name: "c" })).toBeInTheDocument();
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
