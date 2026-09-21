// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PawPrint } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("renders the title, description and an optional action", () => {
    render(
      <EmptyState
        icon={PawPrint}
        title="No pets yet"
        description="Register your first patient to begin."
        action={<button>Add pet</button>}
      />,
    );

    expect(screen.getByText("No pets yet")).toBeInTheDocument();
    expect(
      screen.getByText("Register your first patient to begin."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add pet" })).toBeInTheDocument();
  });

  it("renders without an action", () => {
    render(
      <EmptyState
        icon={PawPrint}
        title="No matches"
        description="Try a different search."
      />,
    );

    expect(screen.getByText("No matches")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  describe("inline", () => {
    it("renders the message with no frame and no icon", () => {
      // A card section that happens to be empty must not shout louder than
      // the sections beside it that have content. Four of them on one page
      // in the page-sized frame would be all the reader sees.
      const { container } = render(
        <EmptyState size="inline" title="Henüz aşı kaydı yok." />,
      );

      expect(screen.getByText("Henüz aşı kaydı yok.")).toBeInTheDocument();
      expect(container.querySelector("svg")).toBeNull();
      const root = container.firstElementChild!;
      expect(root.className).not.toContain("border");
      expect(root.className).not.toContain("rounded");
    });

    it("cannot be given an icon, a description or an action", () => {
      // The props that make the page-sized state right are exactly what
      // makes it the wrong size inside a card, so they are a compile error
      // rather than a convention.
      // @ts-expect-error - an inline empty state takes no icon.
      render(<EmptyState size="inline" title="x" icon={PawPrint} />);
      // @ts-expect-error - an inline empty state takes no description.
      render(<EmptyState size="inline" title="x" description="y" />);
      // @ts-expect-error - an inline empty state takes no action.
      render(<EmptyState size="inline" title="x" action={<button>z</button>} />);
    });
  });
});
