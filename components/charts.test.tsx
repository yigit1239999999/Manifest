// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ColumnBars, HorizontalBars, type BarDatum } from "@/components/charts";

/** The bar element of each bucket, or null where nothing was drawn. */
function barHeights(container: HTMLElement) {
  return [...container.querySelectorAll("[role='img'] > div")].map((cell) => {
    const bar = cell.querySelector("div");
    return bar ? (bar as HTMLElement).style.height : null;
  });
}

const weeks = (...values: number[]): BarDatum[] =>
  values.map((value, i) => ({ label: `W${i + 1}`, value }));

describe("ColumnBars", () => {
  describe("empty clinic", () => {
    // The dashboard gap-fills its series to a fixed 12 weeks / 6 months, so
    // `data` is never empty. A new clinic arrives as twelve zeroes, and the
    // old length check never fired for it.
    it("shows the empty label when every bucket is zero", () => {
      render(
        <ColumnBars data={weeks(0, 0, 0, 0)} emptyLabel="Henüz vizit yok." />,
      );
      expect(screen.getByText("Henüz vizit yok.")).toBeInTheDocument();
    });

    it("draws no bars at all when every bucket is zero", () => {
      const { container } = render(
        <ColumnBars data={weeks(0, 0, 0)} emptyLabel="Henüz vizit yok." />,
      );
      expect(container.querySelector("[role='img']")).toBeNull();
    });

    it("still handles a genuinely empty series", () => {
      render(<ColumnBars data={[]} emptyLabel="Henüz vizit yok." />);
      expect(screen.getByText("Henüz vizit yok.")).toBeInTheDocument();
    });

    it("renders nothing rather than inventing copy when no label is given", () => {
      const { container } = render(<ColumnBars data={weeks(0, 0)} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("zero is not one", () => {
    // The defect this test exists for: a floor of 2% drew an empty week and a
    // one-visit week at the same height on a busy clinic's chart.
    it("draws nothing for a zero bucket", () => {
      const { container } = render(<ColumnBars data={weeks(50, 0, 25)} />);
      expect(barHeights(container)[1]).toBeNull();
    });

    it("draws something for a bucket of one next to a tall bar", () => {
      const { container } = render(<ColumnBars data={weeks(50, 1)} />);
      const [tall, small] = barHeights(container);
      expect(tall).toBe("100%");
      expect(small).toBe("2%");
    });

    it("keeps a small non-zero bucket visible", () => {
      // 1 of 500 rounds to 0.2% — without a pixel floor it would disappear
      // and read as "nothing happened", which is a different fact.
      const { container } = render(<ColumnBars data={weeks(500, 1)} />);
      const cells = container.querySelectorAll("[role='img'] > div");
      const bar = cells[1].querySelector("div") as HTMLElement;
      expect(bar).not.toBeNull();
      expect(bar.style.minHeight).toBe("2px");
    });

    it("scales bars against the tallest bucket", () => {
      const { container } = render(<ColumnBars data={weeks(10, 5)} />);
      expect(barHeights(container)).toEqual(["100%", "50%"]);
    });
  });

  describe("accessibility", () => {
    it("describes the whole series in one label", () => {
      // Without this the chart is a silent pile of divs.
      render(<ColumnBars data={weeks(3, 0, 7)} />);
      expect(screen.getByRole("img")).toHaveAccessibleName(
        "W1: 3, W2: 0, W3: 7",
      );
    });

    it("reads formatted values rather than raw numbers", () => {
      render(
        <ColumnBars
          data={[{ label: "Mart", value: 150000 }]}
          formatValue={(v) => `₺${v / 100}`}
        />,
      );
      expect(screen.getByRole("img")).toHaveAccessibleName("Mart: ₺1500");
    });

    it("prefers an explicit display string over a formatter", () => {
      render(
        <ColumnBars
          data={[{ label: "Mart", value: 150000, display: "1.500,00 ₺" }]}
          formatValue={(v) => `₺${v}`}
        />,
      );
      expect(screen.getByRole("img")).toHaveAccessibleName("Mart: 1.500,00 ₺");
    });

    it("names a zero bucket as zero, not as missing", () => {
      render(<ColumnBars data={weeks(0, 4)} />);
      expect(screen.getByRole("img")).toHaveAccessibleName("W1: 0, W2: 4");
    });
  });

  it("labels every bucket visually", () => {
    render(<ColumnBars data={weeks(1, 2, 3)} />);
    for (const label of ["W1", "W2", "W3"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe("HorizontalBars", () => {
  it("shows the empty label for an empty series", () => {
    render(<HorizontalBars data={[]} emptyLabel="Henüz vizit yok." />);
    expect(screen.getByText("Henüz vizit yok.")).toBeInTheDocument();
  });

  it("writes each value out rather than hiding it in a tooltip", () => {
    render(<HorizontalBars data={[{ label: "Kedi", value: 12 }]} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Kedi")).toBeInTheDocument();
  });

  it("scales bars against the tallest value", () => {
    const { container } = render(
      <HorizontalBars
        data={[
          { label: "Kedi", value: 10 },
          { label: "Köpek", value: 5 },
        ]}
      />,
    );
    const widths = [...container.querySelectorAll("li > span > span")].map(
      (el) => (el as HTMLElement).style.width,
    );
    expect(widths).toEqual(["100%", "50%"]);
  });

  it("uses logical direction utilities only", () => {
    // TEAM.md #31 — this file had a `text-right` before.
    const { container } = render(
      <HorizontalBars data={[{ label: "Kedi", value: 12 }]} />,
    );
    const classes = [...container.querySelectorAll("*")].flatMap(
      (el) => el.getAttribute("class")?.split(/\s+/) ?? [],
    );
    expect(classes.filter((c) => /^text-(left|right)$/.test(c))).toEqual([]);
  });
});
