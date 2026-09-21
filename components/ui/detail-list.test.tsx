// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailList } from "@/components/ui/detail-list";

describe("DetailList", () => {
  it("pairs every label with its value as a description list", () => {
    // The four hand-written copies were loose spans in a div, which a
    // screen reader reads as unrelated fragments rather than pairs.
    const { container } = render(
      <DetailList
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
      <DetailList
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
    render(<DetailList items={[{ label: "Kilo", value: 0 }]} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
  });

  it("renders a value that is not text", () => {
    // Owner names are links and the odd value is a badge.
    render(
      <DetailList
        items={[{ label: "Sahibi", value: <button>Ayşe</button> }]}
      />,
    );
    expect(screen.getByRole("button", { name: "Ayşe" })).toBeInTheDocument();
  });

  it("stacks by default and puts label and value on one line when inline", () => {
    const stacked = render(
      <DetailList items={[{ label: "Adres", value: "x" }]} />,
    ).container.querySelector("dt")!.parentElement!;
    expect(stacked.className).toContain("flex-col");

    const inline = render(
      <DetailList layout="inline" items={[{ label: "Kilo", value: "4 kg" }]} />,
    ).container.querySelector("dt")!.parentElement!;
    expect(inline.className).toContain("justify-between");
    expect(inline.className).not.toContain("flex-col");
  });

  it("uses logical direction utilities only", () => {
    // TEAM.md #31. An inline pair pushed apart with `mr-auto` is the
    // obvious way to write it and the wrong one.
    const { container } = render(
      <DetailList
        layout="inline"
        columns={2}
        items={[{ label: "Kilo", value: "4 kg" }]}
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
