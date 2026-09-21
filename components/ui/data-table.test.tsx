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
