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
    describe("a footnote about what is not in the picture", () => {
    // dev needed this for the dashboard: revenue in other currencies
    // cannot be added to the total, so the chart plots one currency and
    // has to say so. The reason it is a prop and not a `<p>` the page
    // puts underneath is the second assertion here — a caller can draw a
    // line, but it cannot reach inside the `aria-label`.
    it("prints under the bars and joins the summary", () => {
      const note = "Ayrıca $11.595,67 · 4 fatura · grafikte yok";
      render(
        <ColumnBars
          data={weeks(10, 8, 3)}
          emptyLabel="Veri yok."
          footnote={note}
        />,
      );

      expect(screen.getByText(note)).toBeInTheDocument();
      expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
        note,
      );
    });

    it("says nothing at all when there is nothing to say", () => {
      // Not an empty line, not a dash, not "0 invoices" (TEAM.md #21).
      const { container } = render(
        <ColumnBars data={weeks(10, 8, 3)} emptyLabel="Veri yok." />,
      );
      expect(container.querySelectorAll("p")).toHaveLength(0);
      expect(
        screen.getByRole("img").getAttribute("aria-label"),
      ).not.toContain("undefined");
    });

    it("still reads the series first, with the footnote after it", () => {
      // The summary is the chart; the footnote is a caveat on it. Read in
      // the other order it sounds like the chart is about the caveat.
      render(
        <ColumnBars
          data={weeks(10, 8, 3)}
          emptyLabel="Veri yok."
          footnote="grafikte yok"
        />,
      );
      const label = screen.getByRole("img").getAttribute("aria-label")!;
      expect(label.indexOf("grafikte yok")).toBeGreaterThan(0);
      expect(label.startsWith("grafikte yok")).toBe(false);
    });
  });

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

    it("cannot be built without an empty label", () => {
      // It used to render nothing at all when `emptyLabel` was omitted, and
      // the revenue chart omitted it — a card with a title and a blank body,
      // which reads as still loading or broken. The prop is required now, so
      // this is a type error rather than a runtime blank.
      // @ts-expect-error - omitting emptyLabel must not compile.
      render(<ColumnBars data={weeks(0, 0)} />);
      // Nothing is asserted about the output: the point is the line above.
    });
  });

  describe("zero is not one", () => {
    // The defect this test exists for: a floor of 2% drew an empty week and a
    // one-visit week at the same height on a busy clinic's chart.
    it("draws nothing for a zero bucket", () => {
      const { container } = render(<ColumnBars emptyLabel="Veri yok." data={weeks(50, 0, 25)} />);
      expect(barHeights(container)[1]).toBeNull();
    });

    it("draws something for a bucket of one next to a tall bar", () => {
      const { container } = render(<ColumnBars emptyLabel="Veri yok." data={weeks(50, 1)} />);
      const [tall, small] = barHeights(container);
      expect(tall).toBe("100%");
      expect(small).toBe("2%");
    });

    it("keeps a small non-zero bucket visible", () => {
      // 1 of 500 rounds to 0.2% — without a pixel floor it would disappear
      // and read as "nothing happened", which is a different fact.
      const { container } = render(<ColumnBars emptyLabel="Veri yok." data={weeks(500, 1)} />);
      const cells = container.querySelectorAll("[role='img'] > div");
      const bar = cells[1].querySelector("div") as HTMLElement;
      expect(bar).not.toBeNull();
      expect(bar.style.minHeight).toBe("2px");
    });

    it("scales bars against the tallest bucket", () => {
      const { container } = render(<ColumnBars emptyLabel="Veri yok." data={weeks(10, 5)} />);
      expect(barHeights(container)).toEqual(["100%", "50%"]);
    });
  });

  describe("accessibility", () => {
    it("describes the whole series in one label", () => {
      // Without this the chart is a silent pile of divs.
      render(<ColumnBars emptyLabel="Veri yok." data={weeks(3, 0, 7)} />);
      expect(screen.getByRole("img")).toHaveAccessibleName(
        "W1: 3, W2: 0, W3: 7",
      );
    });

    it("reads formatted values rather than raw numbers", () => {
      render(
        <ColumnBars
          data={[{ label: "Mart", value: 150000 }]}
          emptyLabel="Veri yok."
          formatValue={(v) => `₺${v / 100}`}
        />,
      );
      expect(screen.getByRole("img")).toHaveAccessibleName("Mart: ₺1500");
    });

    it("prefers an explicit display string over a formatter", () => {
      render(
        <ColumnBars
          data={[{ label: "Mart", value: 150000, display: "1.500,00 ₺" }]}
          emptyLabel="Veri yok."
          formatValue={(v) => `₺${v}`}
        />,
      );
      expect(screen.getByRole("img")).toHaveAccessibleName("Mart: 1.500,00 ₺");
    });

    it("names a zero bucket as zero, not as missing", () => {
      render(<ColumnBars emptyLabel="Veri yok." data={weeks(0, 4)} />);
      expect(screen.getByRole("img")).toHaveAccessibleName("W1: 0, W2: 4");
    });
  });

  describe("a period still running", () => {
    // The dashboard said "we are down" every Monday. The last bucket of a
    // rolling window is the week or month we are currently in, so it is
    // always shorter than the finished ones beside it.
    const partial = { note: "Son sütun devam eden dönemi gösterir.", inProgress: "devam ediyor" };

    it("says so in writing, not only in the drawing", () => {
      render(<ColumnBars data={weeks(10, 8, 3)} emptyLabel="x" partialLast={partial} />);
      expect(screen.getByText(partial.note)).toBeInTheDocument();
    });

    it("says so to a screen reader too", () => {
      // Half a fix is still the false fall for anyone who cannot see the
      // stripes: the visual mark and the summary go together.
      render(<ColumnBars data={weeks(10, 8, 3)} emptyLabel="x" partialLast={partial} />);
      expect(screen.getByRole("img")).toHaveAccessibleName(
        "W1: 10, W2: 8, W3: 3 (devam ediyor)",
      );
    });

    it("marks only the last bucket", () => {
      const { container } = render(
        <ColumnBars data={weeks(10, 8, 3)} emptyLabel="x" partialLast={partial} />,
      );
      const bars = [...container.querySelectorAll("[role='img'] > div")].map(
        (cell) => cell.querySelector("div") as HTMLElement,
      );
      expect(bars[0].style.backgroundImage).toBe("");
      expect(bars[1].style.backgroundImage).toBe("");
      expect(bars[2].style.backgroundImage).toContain("repeating-linear-gradient");
    });

    it("marks it with a pattern, not by fading it out", () => {
      // Measured: `primary/40` is 1.79:1 against the card in light and
      // 2.30:1 in dark, under the 3:1 bar for a meaningful graphic — the
      // bar would mark itself by becoming hard to see. The partial bar
      // keeps the same fill as the others and takes stripes instead.
      const { container } = render(
        <ColumnBars data={weeks(10, 3)} emptyLabel="x" partialLast={partial} />,
      );
      const bars = [...container.querySelectorAll("[role='img'] > div")].map(
        (cell) => cell.querySelector("div") as HTMLElement,
      );
      expect(bars[1].className).toContain("bg-primary/80");
      expect(bars[1].className).not.toMatch(/bg-primary\/[1-7]0\b/);
      expect(bars[1].className).toEqual(bars[0].className);
    });

    it("changes nothing when the caller does not ask for it", () => {
      const { container } = render(<ColumnBars data={weeks(10, 3)} emptyLabel="x" />);
      expect(screen.queryByText(partial.note)).toBeNull();
      expect(screen.getByRole("img")).toHaveAccessibleName("W1: 10, W2: 3");
      const last = container.querySelectorAll("[role='img'] > div")[1]
        .querySelector("div") as HTMLElement;
      expect(last.style.backgroundImage).toBe("");
    });
  });

  it("labels every bucket visually", () => {
    render(<ColumnBars emptyLabel="Veri yok." data={weeks(1, 2, 3)} />);
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
    render(<HorizontalBars emptyLabel="Veri yok." data={[{ label: "Kedi", value: 12 }]} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Kedi")).toBeInTheDocument();
  });

  it("sets the values in tabular figures", () => {
    // The values sit in a fixed-width column at the end of each row, one
    // under the other. In proportional digits "1" is narrower than "8", so
    // "12" and "8" do not line up on their last digit and the column reads
    // as ragged.
    render(
      <HorizontalBars
        emptyLabel="Veri yok."
        data={[
          { label: "Kedi", value: 12 },
          { label: "Köpek", value: 8 },
        ]}
      />,
    );
    expect(screen.getByText("12").className).toContain("tabular-nums");
    expect(screen.getByText("8").className).toContain("tabular-nums");
  });

  it("scales bars against the tallest value", () => {
    const { container } = render(
      <HorizontalBars emptyLabel="Veri yok."
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
      <HorizontalBars emptyLabel="Veri yok." data={[{ label: "Kedi", value: 12 }]} />,
    );
    const classes = [...container.querySelectorAll("*")].flatMap(
      (el) => el.getAttribute("class")?.split(/\s+/) ?? [],
    );
    expect(classes.filter((c) => /^text-(left|right)$/.test(c))).toEqual([]);
  });
});
