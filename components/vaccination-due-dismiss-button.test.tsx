// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// Hoisted, because `vi.mock` is: a plain top-level const would not exist
// yet when the factory runs.
const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { VaccinationDueDismissButton } from "@/components/vaccination-due-dismiss-button";

function row(action: (dismissed: boolean) => Promise<{ error?: string }>) {
  return render(
    <VaccinationDueDismissButton
      action={action}
      label="Kapat"
      name="Zeytin · Karma aşı satırını kapat"
      undoLabel="Geri al"
      undoneLabel="Aşı satırı kapatıldı."
    />,
  );
}

describe("closing an overdue vaccination row", () => {
  it("is named by the row it belongs to, not just by what it does", () => {
    // Five rows would otherwise carry five buttons all called "Kapat",
    // and which row you are on is carried entirely by where you happen
    // to be in the list (TEAM.md #26).
    row(async () => ({}));

    expect(
      screen.getByRole("button", { name: "Zeytin · Karma aşı satırını kapat" }),
    ).toBeInTheDocument();
  });

  it("offers the way back in the toast, because the row is gone by then", async () => {
    // The card hides what it closes, so a mis-click removes the row and
    // its own undo at the same moment. The toast is the only place the
    // way back can live while the row is still in mind.
    const action = vi.fn(async () => ({}));
    row(action);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(action).toHaveBeenCalledWith(true);
    const [, options] = toast.success.mock.calls.at(-1)!;
    expect(options.action.label).toBe("Geri al");

    await act(async () => options.action.onClick());
    expect(action).toHaveBeenLastCalledWith(false);
  });

  it("says so when the server refuses, instead of looking closed", async () => {
    // The row stays on screen in this case, so without the toast the
    // click would read as a click that did nothing at all.
    row(async () => ({ error: "Bu işlem için yetkiniz yok." }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(toast.error).toHaveBeenCalledWith("Bu işlem için yetkiniz yok.");
  });
});
