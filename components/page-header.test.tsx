// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
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

/**
 * The clip is off unless a page says it has somewhere to put the rest.
 *
 * A heading cut at three lines is a presentation decision only while
 * the whole of the text is also on the page. Without that it is a
 * decision about the record, and the person making it does not notice
 * (ux). The clip therefore belongs to the caller, and the list of
 * callers is checked here rather than trusted to a comment: the first
 * version of this shipped as `line-clamp-3` on every heading in the
 * product, where the precondition holds on exactly one page.
 */
describe("a title that is free text rather than a name", () => {
  it("is off by default", () => {
    const { container } = render(<PageHeader title="Zeytin" />);

    expect(container.querySelector("h1")!.className).not.toContain(
      "line-clamp",
    );
  });

  it("is on when the page asks", () => {
    const { container } = render(<PageHeader title="Zeytin" titleIsFreeText />);

    expect(container.querySelector("h1")!.className).toContain("line-clamp-3");
  });

  it("is asked for by one page, and a second one has to be argued", () => {
    // Not a style rule: each page that clips owes the same argument --
    // where does a reader find the part that was cut. Adding a caller
    // turns this red on purpose, so the argument gets made rather than
    // inherited.
    // `process.cwd()` rather than `import.meta.url`: this file runs in
    // jsdom, where `import.meta.url` is not a file URL.
    const projectRoot = `${process.cwd()}/`;
    const callers: string[] = [];
    let scanned = 0;
    (function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx$/.test(entry.name) && !path.endsWith("page-header.tsx")) {
          scanned++;
          if (/\btitleIsFreeText\b/.test(readFileSync(path, "utf8"))) {
            callers.push(path.slice(projectRoot.length));
          }
        }
      }
    })(`${projectRoot}app`);

    // A scan that found nothing to scan would pass for the wrong
    // reason -- the same trap the locator guard names.
    expect(scanned).toBeGreaterThan(20);
    expect(callers).toEqual(["app/(app)/visits/[id]/(record)/page.tsx"]);
  });
});
