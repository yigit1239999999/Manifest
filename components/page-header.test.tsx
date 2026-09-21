// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "@/components/page-header";

describe("PageHeader", () => {
  it("renders the title as the page's heading", () => {
    render(<PageHeader title="Faturalar" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Faturalar",
    );
  });

  it("omits the description element when there is none", () => {
    // TEAM.md #21: no value means no element, not an invented sentence.
    const { container } = render(<PageHeader title="Faturalar" />);
    expect(container.querySelector("p")).toBeNull();
  });

  describe("badge slot", () => {
    it("puts a status badge beside the heading, not among the actions", () => {
      // The detail pages were passing it in `children`, which is the action
      // row: a pill between "Edit" and "Archive" reads as a third button.
      render(
        <PageHeader title="#1024" badge={<span>Ödendi</span>}>
          <button>Düzenle</button>
        </PageHeader>,
      );
      const heading = screen.getByRole("heading", { level: 1 });
      const badge = screen.getByText("Ödendi");
      const action = screen.getByRole("button", { name: "Düzenle" });

      expect(heading.parentElement).toContainElement(badge);
      expect(heading.parentElement).not.toContainElement(action);
    });

    it("renders nothing extra when there is no badge", () => {
      render(<PageHeader title="Faturalar" />);
      expect(
        screen.getByRole("heading", { level: 1 }).parentElement?.children,
      ).toHaveLength(1);
    });

    it("lets the badge row wrap with a long title", () => {
      // TEAM.md #32: the longest translation has to fit next to the pill.
      render(
        <PageHeader
          title="Pamuk · Ayşe Nur Kahramanoğulları"
          badge={<span>Kısmen ödendi</span>}
        />,
      );
      const row = screen.getByRole("heading", { level: 1 }).parentElement!;
      expect(row.className).toContain("flex-wrap");
    });
  });

  describe("actions", () => {
    // The real case: /pets/[id] renders four of them, each a button with
    // `whitespace-nowrap`, on a 390px screen.
    const fourActions = (
      <PageHeader
        title="Pamuk"
        description="Kedi · Tekir · Dişi · 3 yaş 2 ay"
      >
        <button>Yeni vizit</button>
        <button>Yeni randevu</button>
        <button>Düzenle</button>
        <button>Arşivle</button>
      </PageHeader>
    );

    it("keeps every action in the document", () => {
      render(fourActions);
      for (const label of ["Yeni vizit", "Yeni randevu", "Düzenle", "Arşivle"]) {
        expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
      }
    });

    it("lets the row wrap instead of running off the screen", () => {
      // jsdom has no layout, so the class is what can be pinned here. It
      // stands in for the measurement: four nowrap buttons in a non-wrapping
      // flex row overflow a 390px viewport, and an action past the edge is
      // the same as a hidden one (TEAM.md #27).
      render(fourActions);
      const row = screen.getByRole("button", { name: "Düzenle" }).parentElement;
      expect(row?.className).toContain("flex-wrap");
    });

    it("never clips the row to hide the overflow", () => {
      // The other way this gets "fixed": hiding the overflow, which loses
      // the action silently instead of visibly.
      const { container } = render(fourActions);
      const classes = [...container.querySelectorAll("*")]
        .flatMap((el) => el.getAttribute("class")?.split(/\s+/) ?? []);
      expect(classes).not.toContain("overflow-hidden");
      expect(classes).not.toContain("truncate");
    });
  });

  it("uses logical direction utilities only", () => {
    // TEAM.md #31.
    const { container } = render(
      <PageHeader title="Pamuk" description="Kedi">
        <button>Düzenle</button>
      </PageHeader>,
    );
    const classes = [...container.querySelectorAll("*")]
      .flatMap((el) => el.getAttribute("class")?.split(/\s+/) ?? []);
    const physical = classes.filter((c) =>
      /^-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-(left|right))(-|$)/.test(
        c,
      ),
    );
    expect(physical).toEqual([]);
  });
});
