// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "@/components/ui/field";

describe("Field", () => {
  it("renders the label and its child control", () => {
    render(
      <Field label="First name">
        <input aria-label="first-name-input" />
      </Field>,
    );

    expect(screen.getByText("First name")).toBeInTheDocument();
    expect(screen.getByLabelText("first-name-input")).toBeInTheDocument();
  });

  it("shows a required marker when the field is required", () => {
    render(
      <Field label="Email" required>
        <input />
      </Field>,
    );

    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders the first validation error", () => {
    render(
      <Field label="Email" error={["Enter a valid email", "Secondary message"]}>
        <input />
      </Field>,
    );

    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.queryByText("Secondary message")).not.toBeInTheDocument();
  });

  it("hides the hint while an error is shown", () => {
    render(
      <Field label="Email" hint="We never share it" error={["Bad email"]}>
        <input />
      </Field>,
    );

    expect(screen.getByText("Bad email")).toBeInTheDocument();
    expect(screen.queryByText("We never share it")).not.toBeInTheDocument();
  });

  it("shows the hint when there is no error", () => {
    render(
      <Field label="Email" hint="We never share it">
        <input />
      </Field>,
    );

    expect(screen.getByText("We never share it")).toBeInTheDocument();
  });
});
