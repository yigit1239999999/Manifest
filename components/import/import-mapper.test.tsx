// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";
import { ImportMapper } from "@/components/import/import-mapper";
import type { Cell, SheetTable } from "@/modules/import/read-workbook";

/**
 * The mapping screen, at the two places it is allowed to be wrong.
 *
 * ONE: the order. The column cards read body rows, and which rows are the
 * body is the vet's answer to the header question. Drawing the cards before
 * the answer would classify the heading "Tel" as one of the phone column's
 * values -- the contamination `read-workbook` refuses to commit on the vet's
 * behalf, undone by the screen that was built to ask about it.
 *
 * TWO: whose data is on screen. The samples are the vet's real values. The
 * masked ones exist for a model (`modules/import/mask.ts`) and a person
 * reading `Xxxx Xxxxx` under "Adı" cannot tell an animal from its owner,
 * which is the question the card is asking them.
 */
const text = (value: string): Cell => ({ text: value, source: "text" });

function sheet(rows: string[][], name = "Sayfa1"): SheetTable {
  return {
    name,
    rows: rows.map((row) => row.map(text)),
    columnCount: Math.max(...rows.map((r) => r.length)),
  };
}

function mount(sheets: SheetTable[]) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ sheets }),
  }));
  vi.stubGlobal("fetch", fetchMock);

  const view = render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      <ImportMapper />
    </NextIntlClientProvider>,
  );
  const input = view.container.querySelector<HTMLInputElement>("#import-file")!;
  const file = new File(["x"], "kayitlar.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  fireEvent.change(input, { target: { files: [file] } });
  return view;
}

/** The upload is mocked, so the rows arrive on a microtask rather than a tick. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const WITH_HEADING = [
  ["Adı", "Tel"],
  ["Boncuk", "0532 111 22 33"],
  ["Pamuk", "0533 444 55 66"],
];

describe("the mapping screen", () => {
  it("asks about the first row before it reads any column", async () => {
    mount([sheet(WITH_HEADING)]);
    await settle();

    expect(screen.getByText(tr.import.headerQuestion)).toBeInTheDocument();
    // No cards yet, and no answer chosen for the vet.
    expect(screen.queryByText(tr.import.fieldLabel)).toBeNull();
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLInputElement).checked).toBe(false);
    }
  });

  it("shows the vet their own values, not masked ones", async () => {
    mount([sheet(WITH_HEADING)]);
    await settle();
    fireEvent.click(screen.getByLabelText(tr.import.headerOption.names));

    // Their heading, unedited, and their rows.
    expect(screen.getByText("Adı")).toBeInTheDocument();
    expect(screen.getByText("0532 111 22 33")).toBeInTheDocument();
    expect(screen.queryByText(/Xxxx/)).toBeNull();
  });

  it("keeps the heading out of the column's evidence", async () => {
    mount([sheet(WITH_HEADING)]);
    await settle();
    fireEvent.click(screen.getByLabelText(tr.import.headerOption.names));

    // "Tel" is a heading, not a value. Classified with the two numbers
    // below it, the column's values would no longer agree and it would stop
    // being a phone column at all -- which is the whole reason the question
    // comes first.
    const phoneCard = screen.getByText("Tel").closest<HTMLElement>("div.rounded-surface")!;
    const options = within(phoneCard)
      .getAllByRole("option")
      .map((o) => o.getAttribute("value"));
    // The empty first entry is the unanswered state, not a field.
    expect(options).toEqual(["", "client.phone", "client.secondaryPhone", "skip"]);
    // Two phone fields, so this is a question and not an answer: a heading
    // orders the candidates, it never settles which of the two this is.
    expect(within(phoneCard).getByText(tr.import.asksYou)).toBeInTheDocument();
    // And the heading is nowhere in the samples.
    expect(
      within(phoneCard).getAllByRole("listitem").map((li) => li.textContent),
    ).toEqual(["0532 111 22 33", "0533 444 55 66"]);
  });

  it("treats the first row as a record when the vet says so", async () => {
    mount([sheet(WITH_HEADING)]);
    await settle();
    fireEvent.click(screen.getByLabelText(tr.import.headerOption.record));

    // No heading was claimed, so the card says it has none rather than
    // borrowing the word above it.
    expect(screen.getAllByText(tr.import.headingNone).length).toBe(2);
    // And the top row is now a value like any other.
    expect(screen.getByText("Boncuk")).toBeInTheDocument();
  });

  it("says it cannot tell when every column is text", async () => {
    mount([sheet([["Boncuk", "Kedi"], ["Pamuk", "Köpek"]])]);
    await settle();

    expect(screen.getByText(tr.import.headerCannotTell)).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLInputElement).checked).toBe(false);
    }
  });

  it("does not ask which sheet when there is only one", async () => {
    mount([sheet(WITH_HEADING)]);
    await settle();

    expect(screen.queryByText(tr.import.sheetQuestion)).toBeNull();
  });

  it("asks which sheet when the book has more than one", async () => {
    mount([sheet(WITH_HEADING), sheet([["Boncuk"]], "Sayfa2")]);
    await settle();

    expect(screen.getByText(tr.import.sheetQuestion)).toBeInTheDocument();
  });

  // A choice nobody made used to sit in the select of every unsettled
  // column -- the first candidate, preselected, under a sentence saying the
  // vet would choose. The summary counted it as mapped, so "fine" wrote a
  // decision with no author. Same class as the dash standing where a
  // recorded number should have been (#27): a fact the product does not
  // have, stated as one it does.
  it("leaves an unsettled column unchosen, and says so in the summary", async () => {
    mount([sheet(WITH_HEADING)]);
    await settle();
    fireEvent.click(screen.getByLabelText(tr.import.headerOption.names));

    for (const select of screen.getAllByRole("combobox")) {
      expect((select as HTMLSelectElement).value).toBe("");
    }
    // Both columns are questions here, and the summary counts them as open
    // rather than reporting two fields it has not been given.
    expect(
      screen.getByText(tr.import.summaryUnanswered.replace("{count}", "2")),
    ).toBeInTheDocument();
  });

  it("keeps the answer on a column the values do settle", async () => {
    mount([
      sheet([
        ["Eposta"],
        ["ayse@ornek.test"],
        ["mehmet@ornek.test"],
      ]),
    ]);
    await settle();
    fireEvent.click(screen.getByLabelText(tr.import.headerOption.names));

    // One candidate and decidable values: the product has the answer, and
    // asking anyway would be work for the vet with nothing behind it.
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("client.email");
    expect(screen.getByText(tr.import.settledNote)).toBeInTheDocument();
    expect(screen.queryByText(tr.import.fieldUnset)).toBeNull();
  });

  it("offers no import button, because nothing is saved yet", async () => {
    mount([sheet(WITH_HEADING)]);
    await settle();
    fireEvent.click(screen.getByLabelText(tr.import.headerOption.names));

    expect(screen.getByText(tr.import.summaryNoWriteYet)).toBeInTheDocument();
    // The only button on the screen is the one that asks for the unanswered
    // questions; a disabled "Import" here would promise a screen that does
    // not exist.
    expect(screen.queryByRole("button", { name: /aktar/i })).toBeNull();
  });
});
