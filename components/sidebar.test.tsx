// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";
import type { Permission } from "@/lib/permissions";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

const { Sidebar } = await import("@/components/sidebar");

const renderAt = (path: string, permissions: Permission[] = []) => {
  pathname.value = path;
  return render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      <Sidebar permissions={permissions} />
    </NextIntlClientProvider>,
  );
};

describe("Sidebar", () => {
  it("names every link, including on the narrow icon rail", () => {
    // Below `md` the labels are visually hidden, not `display: none`. With
    // `hidden` they left the accessibility tree too, and a screen reader
    // announced eleven links called "link" (TEAM.md #26).
    renderAt("/");
    for (const name of ["Panel", "Müşteriler", "Hayvanlar", "Faturalar"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("keeps the labels out of `hidden`, which would unname them again", () => {
    const { container } = renderAt("/");
    const labels = [...container.querySelectorAll("nav span")];
    expect(labels.length).toBeGreaterThan(5);
    for (const label of labels) {
      expect(label.className).toContain("sr-only");
      expect(label.className.split(/\s+/)).not.toContain("hidden");
    }
  });

  it("gives the navigation landmark a name", () => {
    renderAt("/");
    expect(screen.getByRole("navigation", { name: "Ana gezinme" })).toBeInTheDocument();
  });

  it("marks the current page for assistive technology, not just in colour", () => {
    renderAt("/pets");
    expect(screen.getByRole("link", { name: "Hayvanlar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Panel" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("does not treat every route as the dashboard", () => {
    // `/` is a prefix of everything, so it needs an exact match.
    renderAt("/invoices/abc");
    expect(screen.getByRole("link", { name: "Panel" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Faturalar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows a link only to a role that may use it", () => {
    renderAt("/");
    expect(screen.queryByRole("link", { name: "Ekip" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Ayarlar" })).toBeNull();

    renderAt("/", ["users.manage", "settings.manage"]);
    expect(screen.getByRole("link", { name: "Ekip" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ayarlar" })).toBeInTheDocument();
  });

  it("hides the audit trail from a role that may not read it", () => {
    // This one was in the list unconditionally, so reception and the vet
    // techs were offered the clinic's entire change history. The page now
    // refuses them, but a link that only ever produces a refusal is still
    // a link they read past on every screen.
    renderAt("/");
    expect(screen.queryByRole("link", { name: "İşlem geçmişi" })).toBeNull();

    renderAt("/", ["audit.read"]);
    expect(
      screen.getByRole("link", { name: "İşlem geçmişi" }),
    ).toBeInTheDocument();
  });

  it("asks for a permission per entry, not a prop per permission", () => {
    // The rule this file exists to hold: adding a guarded route is one line
    // in `NAV`, not a fourth boolean on the component. If a permission ever
    // arrives by a second route again, this count stops matching.
    renderAt("/", ["audit.read", "users.manage", "settings.manage"]);
    expect(screen.getAllByRole("link")).toHaveLength(12); // 11 nav + the logo
  });
});
