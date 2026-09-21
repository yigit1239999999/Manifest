// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DescriptionList } from "@/components/ui/description-list";

describe("DescriptionList", () => {
  it("pairs every label with its value as a description list", () => {
    // The four hand-written copies were loose spans in a div, which a
    // screen reader reads as unrelated fragments rather than pairs.
    const { container } = render(
      <DescriptionList
        items={[
          { label: "E-posta", value: "ayse@example.com" },
          { label: "Telefon", value: "0532 000 00 00" },
        ]}
      />,
    );

    expect(container.querySelector("dl")).not.toBeNull();
    expect(container.querySelectorAll("dt")).toHaveLength(2);
    expect(container.querySelectorAll("dd")).toHaveLength(2);
    expect(screen.getByText("E-posta").tagName).toBe("DT");
    expect(screen.getByText("ayse@example.com").tagName).toBe("DD");
  });

  it("keeps the row when the value is missing, and marks it the same way", () => {
    // An empty field says "nobody filled this in"; a missing row says
    // "there is no such field". Three of the four copies decided this at
    // the call site, each differently.
    render(
      <DescriptionList
        items={[
          { label: "Şehir", value: null },
          { label: "Posta kodu", value: undefined },
          { label: "Adres", value: "" },
        ]}
      />,
    );

    expect(screen.getByText("Şehir")).toBeInTheDocument();
    expect(screen.getAllByText("-")).toHaveLength(3);
  });

  it("does not mistake zero for missing", () => {
    // A weight of 0 and a weight nobody measured are not the same reading.
    render(<DescriptionList items={[{ label: "Kilo", value: 0 }]} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
  });

  it("renders a value that is not text", () => {
    // Owner names are links and the odd value is a badge.
    render(
      <DescriptionList
        items={[{ label: "Sahibi", value: <button>Ayşe</button> }]}
      />,
    );
    expect(screen.getByRole("button", { name: "Ayşe" })).toBeInTheDocument();
  });

  it("stacks by default, and shares a line only from `sm` up in row layout", () => {
    const stacked = render(
      <DescriptionList items={[{ label: "Adres", value: "x" }]} />,
    ).container.querySelector("dt")!.parentElement!;
    expect(stacked.className).toContain("flex-col");
    expect(stacked.className).not.toContain("sm:flex-row");

    // Below `sm` a row pair stacks too. The long Turkish labels
    // ("Solunum sayısı/dk") push the value off a 390px screen when both
    // share a line, and a reading past the edge does not exist.
    const row = render(
      <DescriptionList layout="row" items={[{ label: "Kilo", value: "4 kg" }]} />,
    ).container.querySelector("dt")!.parentElement!;
    expect(row.className).toContain("flex-col");
    expect(row.className).toContain("sm:flex-row");
    expect(row.className).toContain("sm:items-baseline");
  });

  it("sets figures in tabular digits so a column of readings lines up", () => {
    // The vitals card is seven readings under each other. In proportional
    // digits "4,2" and "38,5" do not line up on the comma.
    const { container } = render(
      <DescriptionList
        layout="row"
        items={[
          { label: "Kilo", value: "4,2 kg", numeric: true },
          { label: "Veteriner", value: "Dr. Ada" },
        ]}
      />,
    );
    const [weight, vet] = [...container.querySelectorAll("dd")];
    expect(weight.className).toContain("tabular-nums");
    expect(weight.className).toContain("sm:text-end");
    expect(vet.className).not.toContain("tabular-nums");
  });

  it("keeps the clinician's line breaks in a multiline value", () => {
    const { container } = render(
      <DescriptionList
        items={[
          { label: "Değerlendirme", value: "bir\niki", multiline: true },
        ]}
      />,
    );
    const paragraph = container.querySelector("dd p")!;
    expect(paragraph.className).toContain("whitespace-pre-wrap");
  });

  it("does not wrap an empty multiline value in a paragraph", () => {
    // The mark is one character; a `whitespace-pre-wrap` block around it
    // would give an unfilled field its own line height.
    const { container } = render(
      <DescriptionList
        items={[{ label: "Plan", value: null, multiline: true }]}
      />,
    );
    expect(container.querySelector("dd p")).toBeNull();
    expect(container.querySelector("dd")!.className).toContain(
      "text-muted-foreground",
    );
  });

  it("uses logical direction utilities only", () => {
    // TEAM.md #31. An inline pair pushed apart with `mr-auto` is the
    // obvious way to write it and the wrong one.
    const { container } = render(
      <DescriptionList
        layout="row"
        items={[{ label: "Kilo", value: "4 kg", numeric: true }]}
      />,
    );
    const classes = [...container.querySelectorAll("*")].flatMap(
      (el) => el.getAttribute("class")?.split(/\s+/) ?? [],
    );
    const physical = classes.filter((c) =>
      /^-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-(left|right))(-|$)/.test(
        c,
      ),
    );
    expect(physical).toEqual([]);
  });
});
