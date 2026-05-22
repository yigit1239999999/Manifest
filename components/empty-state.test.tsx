// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PawPrint } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

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
});
