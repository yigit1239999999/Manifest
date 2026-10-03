// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable, type Column } from "@/components/ui/data-table";

type Row = { id: string; name: string; total: string };

const rows: Row[] = [
  { id: "a", name: "Pamuk", total: "1.200,00 ₺" },
  { id: "b", name: "Karamel", total: "480,00 ₺" },
];

const columns: Column<Row>[] = [
  { key: "name", header: "Ad", cell: (r) => r.name },
  { key: "total", header: "Toplam", align: "end", cell: (r) => r.total },
  { key: "vet", header: "Veteriner", hideBelow: "md", cell: () => "Dr. Ada" },
];

const table = (extra: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) =>
  render(
    <DataTable rows={rows} rowKey={(r) => r.id} columns={columns} {...extra} />,
  );

describe("DataTable", () => {
  it("renders a header for every column and a cell for every row", () => {
    table();
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + two rows
    expect(screen.getByText("Pamuk")).toBeInTheDocument();
    expect(screen.getByText("480,00 ₺")).toBeInTheDocument();
  });

  it("marks headers as column scope so a cell knows what it is", () => {
    table();
    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).toHaveAttribute("scope", "col");
    }
  });

  it("can name the table without showing the name", () => {
    const { container } = table({ caption: "Faturalar" });
    const caption = container.querySelector("caption");
    expect(caption).toHaveTextContent("Faturalar");
    expect(caption?.className).toContain("sr-only");
  });

  it("keeps an actions column's header readable while hiding it", () => {
    // An empty `<th />` is what these columns used to be, which leaves every
    // cell under it with no column name at all.
    render(
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: "name", header: "Ad", cell: (r) => r.name },
          {
            key: "actions",
            header: "İşlemler",
            headerHidden: true,
            cell: () => <button>Sil</button>,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "İşlemler" }),
    ).toBeInTheDocument();
  });

  describe("narrow screens", () => {
    it("lets a wide table scroll instead of clipping it", () => {
      // The seven copied tables all wrapped themselves in `overflow-hidden`,
      // which rounds the corners and also cuts off whatever does not fit.
      // On a phone the last columns were simply gone (TEAM.md #27).
      const { container } = table();
      const wrapper = container.firstElementChild!;
      expect(wrapper.className).toContain("overflow-x-auto");
      expect(wrapper.className.split(/\s+/)).not.toContain("overflow-hidden");
    });

    it("is allowed to be narrower than the table inside it", () => {
      // `overflow-x-auto` on its own is not enough. The wrapper is a flex
      // item of the page's `flex flex-col`, and a flex item refuses by
      // default to be narrower than its content — so instead of scrolling,
      // the wrapper grew and took the whole page sideways with it. pm
      // measured it on /staff at 390px: the document was 752px wide and
      // the "New staff member" button was off the screen.
      //
      // Only /staff showed it, because it is the one list with five
      // columns and an unbreakable e-mail address in one of them. The
      // defect was never /staff's.
      const { container } = table();
      expect(container.firstElementChild!.className).toContain("min-w-0");
    });

    it("hides a column from both the header and the body, or from neither", () => {
      // Hiding only one of the two shifts every cell one column across.
      const { container } = table();
      const header = screen.getByRole("columnheader", { name: "Veteriner" });
      expect(header.className).toContain("md:table-cell");

      const bodyCells = [...container.querySelectorAll("tbody td")].filter(
        (td) => td.textContent === "Dr. Ada",
      );
      expect(bodyCells).toHaveLength(2);
      for (const cell of bodyCells) {
        expect(cell.className).toContain("md:table-cell");
      }
    });
  });

  describe("stacking on a narrow container", () => {
    // The invoice list at 390px: 485px of table in 292px of container, and
    // the two columns cut off were the total and the status. Stacking puts
    // the row's name, its amount and its status on the first line.
    type Invoice = { id: string; no: string; client: string; total: string; status: string };
    const invoices: Invoice[] = [
      { id: "a", no: "#1042", client: "Ayşe Yılmaz", total: "1.200,00 ₺", status: "Kısmen ödendi" },
    ];
    const invoiceColumns: Column<Invoice>[] = [
      { key: "no", header: "No", cell: (r) => r.no },
      { key: "client", header: "Müşteri", cell: (r) => r.client },
      { key: "total", header: "Toplam", numeric: true, cell: (r) => r.total },
      { key: "status", header: "Durum", stack: "meta-end", cell: (r) => r.status },
    ];
    const stacked = (narrow?: "scroll" | "stack") =>
      render(
        <DataTable
          rows={invoices}
          rowKey={(r) => r.id}
          columns={invoiceColumns}
          narrow={narrow}
        />,
      );
    const cell = (container: HTMLElement, text: string) =>
      [...container.querySelectorAll("tbody td")].find(
        (td) => td.textContent === text,
      )!;
    const classes = (el: Element) => el.className.split(/\s+/);

    it("puts the amount on the first line, at the end", () => {
      // A numeric column needs no `stack` of its own to get there.
      const td = cell(stacked("stack").container, "1.200,00 ₺");
      expect(classes(td)).toEqual(
        expect.arrayContaining(["@max-lg:ms-auto", "@max-lg:shrink-0"]),
      );
      expect(td.className).not.toMatch(/@max-lg:order-/);
    });

    it("closes the second line with the status", () => {
      const { container } = stacked("stack");
      const status = cell(container, "Kısmen ödendi");
      expect(classes(status)).toEqual(
        expect.arrayContaining([
          "@max-lg:order-3",
          "@max-lg:ms-auto",
          "@max-lg:shrink-0",
        ]),
      );
      // The client is on the same line, before it.
      expect(classes(cell(container, "Ayşe Yılmaz"))).toContain(
        "@max-lg:order-2",
      );
    });

    it("does not let the title be squeezed to make room", () => {
      // `flex-1` let "#INV-2026-57336" shrink to nothing and break at its
      // hyphens. The `end` cell moves down a line instead.
      const title = cell(stacked("stack").container, "#1042");
      expect(classes(title)).toContain("@max-lg:min-w-0");
      expect(classes(title)).not.toContain("@max-lg:flex-1");
      expect(title.className).not.toMatch(/@max-lg:order-/);
    });

    it("keeps the figures figures once stacked", () => {
      // The desktop table must not lose its alignment to gain the cards.
      const td = cell(stacked("stack").container, "1.200,00 ₺");
      expect(classes(td)).toEqual(
        expect.arrayContaining(["tabular-nums", "text-end"]),
      );
    });

    it("measures its own container, not the screen", () => {
      // The sidebar widens at `md`, so the screen grows while the table
      // shrinks; a screen breakpoint would undo the cards at 768px.
      const { container } = stacked("stack");
      expect(classes(container.firstElementChild!)).toContain("@container");
      const row = container.querySelector("tbody tr")!;
      expect(classes(row)).toContain("@max-lg:flex");
      expect(row.className).not.toMatch(/(^|\s)(sm|md|lg):flex\b/);
    });

    it("keeps the column names for screen readers", () => {
      // The header row is off the screen once stacked, not gone: it is
      // what names each cell.
      const { container } = stacked("stack");
      expect(classes(container.querySelector("thead")!)).toContain(
        "@max-lg:sr-only",
      );
      expect(screen.getAllByRole("columnheader")).toHaveLength(4);
    });

    it("leaves a table that does not ask for it alone", () => {
      const { container } = stacked();
      expect(container.innerHTML).not.toContain("@max-lg:");
    });
  });

  it("aligns with logical direction utilities only", () => {
    // TEAM.md #31: `text-right` on a money column is the exact case.
    const { container } = table();
    const classes = [...container.querySelectorAll("*")]
      .flatMap((el) => el.getAttribute("class")?.split(/\s+/) ?? []);
    const physical = classes.filter((c) =>
      /^-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-(left|right))(-|$)/.test(
        c,
      ),
    );
    expect(physical).toEqual([]);
  });

  describe("numeric columns", () => {
    const numericTable = () =>
      render(
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: "Ad", cell: (r) => r.name },
            { key: "total", header: "Toplam", numeric: true, cell: (r) => r.total },
          ]}
        />,
      );

    it("gives figures tabular digits and end alignment together", () => {
      // Right alignment alone only lines up the last digit. "1.200,00" and
      // "480,00" still put their commas in different places, so a column
      // that exists to be compared down its length cannot be.
      const { container } = numericTable();
      const cells = [...container.querySelectorAll("tbody td")].filter((td) =>
        td.textContent?.includes("₺"),
      );
      expect(cells).toHaveLength(2);
      for (const cell of cells) {
        expect(cell.className).toContain("tabular-nums");
        expect(cell.className).toContain("text-end");
      }
      expect(
        screen.getByRole("columnheader", { name: "Toplam" }).className,
      ).toContain("text-end");
    });

    it("leaves a plain end-aligned column proportional", () => {
      // `align: "end"` is also how the "Details →" link column is placed,
      // and a link is not a figure.
      const { container } = table();
      const cells = [...container.querySelectorAll("tbody td")].filter((td) =>
        td.textContent?.includes("₺"),
      );
      for (const cell of cells) {
        expect(cell.className).not.toContain("tabular-nums");
      }
    });
  });

  it("renders nothing but the header when there are no rows", () => {
    // Callers show an EmptyState instead; an empty table must not crash or
    // invent a placeholder row.
    render(<DataTable rows={[]} rowKey={(r: Row) => r.id} columns={columns} />);
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});
