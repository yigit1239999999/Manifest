// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";
import { DeleteButton } from "@/components/delete-button";
import { StaffStatusButton } from "@/components/staff-status-button";
import { CustomSpeciesDeleteButton } from "@/components/custom-species-delete-button";

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
      <StaffStatusButton action={noop} active={false} label="Aktifleştir" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Aktifleştir" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks before switching an account off", () => {
    withIntl(
      <StaffStatusButton
        action={noop}
        active
        label="Devre dışı bırak"
        confirmText="Bu personel devre dışı bırakılsın mı?"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Devre dışı bırak" }));

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
});
