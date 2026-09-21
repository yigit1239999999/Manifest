// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";
import { DeleteButton } from "@/components/delete-button";
import { StaffStatusButton } from "@/components/staff-status-button";
import { CustomSpeciesDeleteButton } from "@/components/custom-species-delete-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// jsdom ships `<dialog>` without the top layer, so `showModal` is missing.
// The dialog's behaviour is the platform's job; what is tested here is that
// the app asks with its own dialog at all, and never with the browser's.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

// `StaffStatusButton` refreshes the list itself after a successful switch,
// so it reads the router. Nothing here asserts on the refresh; the mock only
// gives the component the router a page would.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const withIntl = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      {ui}
    </NextIntlClientProvider>,
  );

const noop = async () => undefined;

describe("confirming an action", () => {
  it("never calls window.confirm", () => {
    // The browser's dialog cannot be styled, cannot be translated (its two
    // buttons follow the operating system), and announces the origin above
    // the question. Three components used it; none may again.
    const confirmSpy = vi.spyOn(window, "confirm");

    withIntl(
      <DeleteButton action={noop} label="Arşivle" confirmText="Arşivlensin mi?" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Arşivle" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("asks the question in a labelled dialog", () => {
    withIntl(
      <DeleteButton
        action={noop}
        label="Arşivle"
        confirmText="Bu hayvan arşivlensin mi?"
        description="Arşivlenen hayvan listelerden kalkar."
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Arşivle" }));

    const dialog = screen.getByRole("dialog", {
      name: "Bu hayvan arşivlensin mi?",
    });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText("Arşivlenen hayvan listelerden kalkar."),
    ).toBeInTheDocument();
  });

  it("offers a way out that is not the word the action already uses", () => {
    // On an appointment the confirming button reads "Randevuyu iptal et";
    // labelling the dismiss button "İptal" would make both of them cancel.
    withIntl(
      <DeleteButton
        action={noop}
        label="Randevuyu iptal et"
        confirmText="Bu randevu iptal edilsin mi?"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Randevuyu iptal et" }));

    expect(screen.getByRole("button", { name: "Vazgeç" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "İptal" })).toBeNull();
  });

  it("does not ask when there is nothing to warn about", () => {
    // Switching a deactivated account back on is not a question.
    withIntl(
      <StaffStatusButton
        action={noop}
        active={false}
        label="Aktifleştir"
        name="Ayşe Yılmaz: Aktifleştir"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ayşe Yılmaz: Aktifleştir" }),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says whose account the button turns off", () => {
    // Five rows carried five buttons all named "Deactivate", so the only
    // thing telling them apart was where they sat on the screen — which
    // is what a screen reader user does not have. Hiding the word below
    // `sm` for width made the name the only channel there is.
    //
    // And the name is built from the visible label rather than written
    // beside it: "Deactivate" has to stay sayable out loud to reach this
    // button, so the two cannot drift apart (TEAM.md #26).
    withIntl(
      <StaffStatusButton
        action={noop}
        active
        label="Devre dışı bırak"
        name="Ayşe Yılmaz: Devre dışı bırak"
        confirmText="Emin misiniz?"
      />,
    );

    const button = screen.getByRole("button", {
      name: "Ayşe Yılmaz: Devre dışı bırak",
    });
    expect(button).toBeInTheDocument();
    expect(button.getAttribute("aria-label")).toContain("Devre dışı bırak");
  });

  it("asks before switching an account off", () => {
    withIntl(
      <StaffStatusButton
        action={noop}
        active
        label="Devre dışı bırak"
        name="Ayşe Yılmaz: Devre dışı bırak"
        confirmText="Bu personel devre dışı bırakılsın mı?"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ayşe Yılmaz: Devre dışı bırak" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Bu personel devre dışı bırakılsın mı?" }),
    ).toBeInTheDocument();
  });

  it("keeps a blocked deletion as a plain disabled button with its reason", () => {
    // A species that still has animals on it cannot be deleted, so there is
    // no question to ask and no dialog to build.
    withIntl(
      <CustomSpeciesDeleteButton
        action={noop}
        label="Sil"
        confirmText="Silinsin mi?"
        disabled
        disabledTitle="Bu tür hayvanlarda kullanılıyor."
      />,
    );

    const button = screen.getByRole("button", { name: "Sil" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // The release blocker this file did not catch, now written down.
  //
  // The dialog used to run its action by submitting a `<form>` of its own.
  // That works everywhere it was first used — beside a page heading, with
  // no form in sight — and fails silently the moment it is placed inside
  // one, which the clinic settings did. Nested forms are invalid HTML, the
  // browser flattens them, and the currency setting saved nothing at all:
  // no error, no toast, the dialog just sitting there.
  //
  // The assertion is structural, and that is not a shortcut — it is the
  // only honest version. jsdom does not reproduce the flattening: React
  // builds the tree node by node rather than through the HTML parser, so a
  // nested form here renders and works, and a behavioural test of "it
  // still fires inside a form" passes with the bug fully present. Checked:
  // putting the old `<form>` back leaves that test green. What can be
  // stated truthfully is that the component contributes no form of its
  // own, which is exactly the property that was missing.
  // Verified by putting the defect back: with the confirming button wrapped
  // in its own `<form action=…>` again, this test fails and the one below
  // it does not. That is the wrong way round from what you would expect and
  // it is the point — jsdom builds the DOM through `appendChild`, so the
  // nesting survives here, while a browser's parser flattens it and the
  // inner action never runs. The behavioural test cannot see the bug; the
  // structural one is what actually holds the rule.
  it("renders no form of its own, so it is safe inside one", () => {
    const { container } = withIntl(
      <ConfirmDialog
        title="Kaydedilsin mi?"
        confirmLabel="Kaydet"
        cancelLabel="Vazgeç"
        tone="default"
        action={noop}
      >
        {(open) => (
          <button type="button" onClick={open}>
            Aç
          </button>
        )}
      </ConfirmDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aç" }));

    expect(container.querySelector("form")).toBeNull();
  });

  it("runs its action from inside another form", async () => {
    // The behaviour, for what it is worth here: the action is called
    // directly rather than submitted, so nothing about the surroundings can
    // stop it. See above for why this alone would not have caught the bug.
    const action = vi.fn(async () => undefined);

    withIntl(
      <form>
        <ConfirmDialog
          title="Kaydedilsin mi?"
          confirmLabel="Kaydet"
          cancelLabel="Vazgeç"
          tone="default"
          action={action}
        >
          {(open) => (
            <button type="button" onClick={open}>
              Aç
            </button>
          )}
        </ConfirmDialog>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aç" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  it("cannot be confirmed twice while it is still running", async () => {
    // A confirmation nobody can click twice is the cheapest place to stop a
    // double submit, and this app has already paid once for not having it.
    let release: () => void = () => {};
    const action = vi.fn(
      () => new Promise<void>((resolve) => (release = () => resolve())),
    );

    withIntl(
      <ConfirmDialog
        title="Silinsin mi?"
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        tone="destructive"
        action={action}
      >
        {(open) => (
          <button type="button" onClick={open}>
            Aç
          </button>
        )}
      </ConfirmDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aç" }));
    const confirm = screen.getByRole("button", { name: "Sil" });
    fireEvent.click(confirm);

    // Busy, not disabled — and this test asserted the mechanism, so
    // it had to change when the mechanism did. A control disabled
    // under the user's finger loses focus to `body`, which in a
    // dialog means focus escapes the dialog; `aria-busy` says the
    // same thing and keeps the button where the user left it.
    await vi.waitFor(() =>
      expect(confirm).toHaveAttribute("aria-busy", "true"),
    );
    expect(confirm).toBeEnabled();
    // Not asserting where focus is: `fireEvent.click` does not move it
    // in jsdom, so there is nothing here to keep or lose and a passing
    // assertion would be about the test environment. What matters —
    // that the button is still focusable because it is still enabled —
    // is the line above. The focus claim belongs in a browser.

    // The half of `disabled` that was worth keeping: the second press
    // does nothing. That is what this test was always about.
    fireEvent.click(confirm);
    expect(action).toHaveBeenCalledTimes(1);

    release();
  });
});
