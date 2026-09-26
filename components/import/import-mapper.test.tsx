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

  // The outline and the eye have to agree. This heading was an `h2` at
  // `text-base` sitting between steps that are `h3` at `text-lg`: a level
  // ABOVE its neighbours, drawn SMALLER than them (pm measured 16px against
  // 18px). Being outside a card is a layout fact, not a rank.
  //
  // Only the level and the size are checked here, because only they are in
  // the source. Whether the screen's open question is heavier than the
  // steps that are already finished is a rendered-page question and belongs
  // to an acceptance run (`gate-matches-how-the-rule-breaks`).
  it("gives the columns step the heading its neighbours have", async () => {
    mount([sheet(WITH_HEADING)]);
    await settle();
    fireEvent.click(screen.getByLabelText(tr.import.headerOption.names));

    const heading = screen.getByText(
      tr.import.columnsTitle.replace("{count}", "2"),
    );
    expect(heading.tagName).toBe("H3");
    expect(heading.className).toContain("text-lg");
  });

  // A column heading is the vet's own word and can have no break
  // opportunity in it: CSS breaks a line at a hyphen and never at an
  // underscore, and `HAYVANIN_KAYITLI_ADI_VE_TAKMA_ADI` is what a clinic's
  // export column is actually called.
  //
  // What this test can and cannot say, because jsdom has no layout engine:
  // the geometry was measured in a browser at 390px on the production build
  // (`a259d5c`, BUILD_ID `gjVP1tYtGLpOwEkqIpdPQ`) and the numbers are in the
  // commit message -- without these two classes the card's min-content
  // became that word, the grid track grew with it, and the field select
  // stood at x=475 on a 390px screen with 110px of sideways scroll. Here
  // only the two classes are checked, which is what the source holds. The
  // rule breaks in layout, so the gate that would catch a regression is an
  // acceptance run rather than this file; this one catches the classes being
  // dropped by somebody who does not know why they are there.
  it("lets an unbroken column heading wrap instead of widening the card", async () => {
    mount([
      sheet([
        ["HAYVANIN_KAYITLI_ADI_VE_TAKMA_ADI_ILE_BIRLIKTE", "Tel"],
        ["Boncuk", "0532 111 22 33"],
      ]),
    ]);
    await settle();
    fireEvent.click(screen.getByLabelText(tr.import.headerOption.names));

    const heading = screen.getByText("HAYVANIN_KAYITLI_ADI_VE_TAKMA_ADI_ILE_BIRLIKTE");
    expect(heading.className).toContain("break-words");
    // The card, and not the paragraph: a grid item is sized by its own
    // content while its `min-width` is `auto`, so `break-words` alone never
    // gets the chance to act. Same pairing as `Callout`.
    //
    // Reached through the grid rather than by a class on the card. The
    // obvious `closest(".min-w-0")` would find whatever it was told to look
    // for and prove nothing; `closest(".self-start")` was what this line
    // used until that class was removed for a measured reason, which is the
    // shape of a locator that breaks when something unrelated moves. The
    // grid is the one thing here that is structural: the columns step draws
    // one, and its children are the cards.
    const grid = screen.getByText("HAYVANIN_KAYITLI_ADI_VE_TAKMA_ADI_ILE_BIRLIKTE")
      .closest("div.grid");
    const card = grid?.firstElementChild;
    expect(card).not.toBeNull();
    expect(card?.contains(heading)).toBe(true);
    expect(card?.className).toContain("min-w-0");
  });

  // The browser's own file control said "Choose File" and "No file chosen"
  // on a Turkish screen, and those words are not ours to write: they come
  // from the browser's interface language, not the page's. So the control
  // is off the screen and the product says both halves itself -- the label
  // is the button, and this is the other half, the one the native control
  // used to carry.
  it("says which file was chosen, since the browser no longer does", async () => {
    mount([sheet(WITH_HEADING)]);
    await settle();
    // `mount` picks "kayitlar.xlsx".
    expect(screen.getByText("kayitlar.xlsx")).toBeInTheDocument();
  });

  it("keeps the file input as the control, off the screen rather than out of it", () => {
    const { container } = mount([sheet(WITH_HEADING)]);
    const input = container.querySelector<HTMLInputElement>("#import-file");
    // Still in the DOM, still the thing the label points at, still
    // reachable by keyboard -- `sr-only` moves it off the screen, it does
    // not remove it. `hidden` or `display:none` would take the control out
    // of the tab order and out of `setInputFiles`' reach, which is how this
    // kind of change usually breaks.
    expect(input).not.toBeNull();
    expect(input?.className).toContain("sr-only");
    expect(input?.disabled).toBe(false);
    // Named by the label it sits inside rather than by a `for` attribute,
    // which is what gives the control its accessible name here.
    expect(input?.closest("label")).not.toBeNull();
    expect(input?.closest("label")?.textContent).toContain(tr.import.chooseFile);
  });

  it("leads to the saving step, and still writes nothing on its own", async () => {
    // This test used to assert the opposite: that the screen ended in the
    // sentence "nothing is created in this step" and offered no button at
    // all. That sentence was true for exactly as long as there was no step
    // behind it, and the step is here now (#40). What survives the change
    // is the half that was never about the missing screen: reading a file
    // and answering questions about it saves nothing by itself, and the
    // vet asks for the next move.
    mount([sheet(WITH_HEADING)]);
    await settle();
    fireEvent.click(screen.getByLabelText(tr.import.headerOption.names));

    expect(screen.getByRole("button", { name: tr.import.planButton })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: tr.import.commitButton })).toBeNull();
    // Nothing has been asked of the server beyond the one upload that read
    // the file: no plan, and certainly no write, until the vet asks.
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/import");
  });
});
