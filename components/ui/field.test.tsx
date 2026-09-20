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

  // DESIGN-1: the form-level Callout announces that a submit failed; these
  // associations are what tell the user WHICH field and WHY, read when focus
  // reaches the control rather than shouted all at once.
  describe("accessibility wiring", () => {
    it("points the control at its error message", () => {
      render(
        <Field label="Telefon" error={["Geçerli bir numara giriniz"]}>
          <input />
        </Field>,
      );

      const control = screen.getByLabelText("Telefon");
      const describedBy = control.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toHaveTextContent(
        "Geçerli bir numara giriniz",
      );
    });

    it("points the control at its hint when there is no error", () => {
      render(
        <Field label="Telefon" hint="Başında 0 olmadan yazınız">
          <input />
        </Field>,
      );

      const describedBy = screen
        .getByLabelText("Telefon")
        .getAttribute("aria-describedby");
      expect(document.getElementById(describedBy!)).toHaveTextContent(
        "Başında 0 olmadan yazınız",
      );
    });

    it("describes the error rather than the hint when both could apply", () => {
      // The hint is not rendered while an error is showing, so a stale
      // reference to it would point at nothing.
      render(
        <Field
          label="Telefon"
          hint="Başında 0 olmadan yazınız"
          error={["Geçerli bir numara giriniz"]}
        >
          <input />
        </Field>,
      );

      const describedBy = screen
        .getByLabelText("Telefon")
        .getAttribute("aria-describedby");
      expect(document.getElementById(describedBy!)).toHaveTextContent(
        "Geçerli bir numara giriniz",
      );
      expect(screen.queryByText("Başında 0 olmadan yazınız")).toBeNull();
    });

    it("leaves aria-describedby off when there is nothing to describe", () => {
      render(
        <Field label="Telefon">
          <input />
        </Field>,
      );
      expect(screen.getByLabelText("Telefon")).not.toHaveAttribute(
        "aria-describedby",
      );
    });

    it("marks an invalid control aria-invalid", () => {
      render(
        <Field label="Telefon" error={["Geçerli bir numara giriniz"]}>
          <input />
        </Field>,
      );
      expect(screen.getByLabelText("Telefon")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });

    it("does not mark a valid control invalid", () => {
      render(
        <Field label="Telefon">
          <input />
        </Field>,
      );
      expect(screen.getByLabelText("Telefon")).not.toHaveAttribute(
        "aria-invalid",
      );
    });

    it("never makes the field a live region", () => {
      // Six invalid fields would queue six assertive announcements and none
      // would be understood. The form-level Callout speaks once instead.
      const { container } = render(
        <Field label="Telefon" error={["Geçerli bir numara giriniz"]}>
          <input />
        </Field>,
      );
      expect(container.querySelector("[aria-live]")).toBeNull();
      expect(container.querySelector('[role="alert"]')).toBeNull();
    });

    it("keeps a description the control already had", () => {
      render(
        <Field label="Telefon" error={["Geçerli bir numara giriniz"]}>
          <input aria-describedby="external-help" />
        </Field>,
      );
      const describedBy = screen
        .getByLabelText("Telefon")
        .getAttribute("aria-describedby");
      expect(describedBy).toContain("external-help");
      expect(describedBy!.split(" ").length).toBe(2);
    });

    it("gives two fields on one page distinct message ids", () => {
      render(
        <>
          <Field label="Telefon" error={["A"]}>
            <input />
          </Field>
          <Field label="E-posta" error={["B"]}>
            <input />
          </Field>
        </>,
      );
      const first = screen.getByLabelText("Telefon").getAttribute("aria-describedby");
      const second = screen.getByLabelText("E-posta").getAttribute("aria-describedby");
      expect(first).not.toEqual(second);
    });

    it("still keeps the required marker out of the accessible name", () => {
      // Pre-existing and correct; the new wiring must not disturb it.
      render(
        <Field label="Telefon" required>
          <input />
        </Field>,
      );
      expect(screen.getByLabelText("Telefon")).toBeInTheDocument();
      expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
    });
  });
});
