// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";
import type { Cell, SheetTable } from "@/modules/import/read-workbook";

const sheets: { current: SheetTable[] } = { current: [] };
vi.mock("@/modules/import/read-file", () => ({
  ReadFileError: class extends Error {},
  readImportFile: vi.fn(async () => sheets.current),
}));

import { ImportMapper } from "@/components/import/import-mapper";

/**
 * The matching screen, at the places the vet said it failed them.
 *
 * The file is read in the browser now, so the reader is mocked and the
 * sheet arrives as the reader would hand it over. The model is "not
 * configured" here (the route answers `available: false`), which is also
 * how every test environment runs: no key, deterministic matching only.
 */
const text = (value: string): Cell => ({ text: value, source: value === "" ? "empty" : "text" });
const sheet = (rows: string[][]): SheetTable => ({
  name: "Hastalar",
  rows: rows.map((row) => row.map(text)),
  columnCount: Math.max(...rows.map((r) => r.length)),
});

const PATIKOY = [
  ["Sahip Adı Soyadı", "Tel", "Hasta Adı", "Tür", "Kuduz Aşısı", "Karma Aşı"],
  ["Ayşe Yılmaz", "0532 411 22 33", "Pamuk", "Kedi", "14.04.2025", "14.04.2025"],
  ["Mehmet Kaya", "05334567890", "Karabaş", "Köpek", "20.09.2024", ""],
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ available: false, suggestions: [] }) })),
  );
});

async function mount(rows: string[][], aiAvailable = false) {
  sheets.current = [sheet(rows)];
  const view = render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      <ImportMapper aiAvailable={aiAvailable} />
    </NextIntlClientProvider>,
  );
  const input = view.container.querySelector<HTMLInputElement>("#import-file")!;
  fireEvent.change(input, { target: { files: [new File(["x"], "patikoy.xlsx")] } });
  await screen.findByText(tr.import.mapTitle);
  return view;
}

describe("the matching screen", () => {
  it("matches a file whose headings say what they are, with nothing left to choose", async () => {
    await mount(PATIKOY);
    expect(screen.getByText("6 sütunun hepsini eşleştirdik. Bir göz atıp devam edin.")).toBeInTheDocument();
    expect((document.querySelector("#import-column-4") as HTMLSelectElement).value).toBe("vaccine.column");
    expect((document.querySelector("#import-vaccine-4") as HTMLInputElement).value).toBe("Kuduz");
    expect((document.querySelector("#import-vaccine-5") as HTMLInputElement).value).toBe("Karma");
  });

  it("says it out loud when a column of vaccination dates is left out, and stops saying 'all matched'", async () => {
    await mount(PATIKOY);
    fireEvent.change(document.querySelector("#import-column-4")!, { target: { value: "skip" } });
    expect(screen.getByText(tr.import.skippedVaccine)).toBeInTheDocument();
    expect(screen.queryByText(/hepsini eşleştirdik/)).toBeNull();
    // One tap puts it back.
    fireEvent.click(screen.getByRole("button", { name: "Kuduz aşısı olarak alın" }));
    expect((document.querySelector("#import-column-4") as HTMLSelectElement).value).toBe("vaccine.column");
  });

  it("shows the vet's own values, never masked ones", async () => {
    await mount(PATIKOY);
    expect(screen.getAllByText(/0532 411 22 33/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Xxxx/)).toBeNull();
  });

  it("asks only about the columns it cannot name, with the proposal as one tap", async () => {
    await mount([
      ["Kolon1", "Kolon2", "Hayvan"],
      ["0532 111 22 33", "Ayşe", "Pamuk"],
      ["0533 222 33 44", "Mehmet", "Boncuk"],
    ]);
    expect(screen.getByText(/3 sütunun 1 tanesini eşleştirdik/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Telefon numarasına benziyor/ }));
    expect((document.querySelector("#import-column-0") as HTMLSelectElement).value).toBe("client.phone");
  });

  it("refuses to continue without an owner column, and says which", async () => {
    await mount([
      ["Hayvan", "Tür"],
      ["Pamuk", "Kedi"],
    ]);
    fireEvent.click(screen.getByRole("button", { name: tr.import.continue }));
    expect(screen.getByText(tr.import.missingOwner)).toBeInTheDocument();
  });

  it("asks the day-or-month question once for the whole file", async () => {
    await mount([
      ["Sahip", "Hayvan", "Doğum Tarihi", "Kuduz"],
      ["Ayşe", "Pamuk", "05/06/2022", "03/04/2025"],
    ]);
    expect(screen.getAllByRole("radio", { name: /Önce gün/ })).toHaveLength(1);
  });

  it("does not read a title row as a client", async () => {
    await mount([
      ["MÜŞTERİ LİSTESİ - Elif", "", "", ""],
      ["", "", "", ""],
      ["isim", "telefon", "hayvan(lar)", "not"],
      ["ayşe yılmaz", "532 411 2233", "Pamuk", "alerjik"],
    ]);
    expect(screen.getByText("Üstteki 2 satır tablonun başlığı gibi duruyor, okumadık.")).toBeInTheDocument();
  });
});

describe("with column matching by AI configured", () => {
  it("asks only about the open columns, masked, and applies a sure answer while offering an unsure one", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: { body?: string }) => ({
      ok: true,
      status: 200,
      json: async () => {
        const body = JSON.parse(init?.body ?? "{}");
        expect(body.columns.map((c: { columnIndex: number }) => c.columnIndex)).toEqual([0, 1]);
        expect(JSON.stringify(body)).not.toContain("Ayşe");
        return {
          available: true,
          suggestions: [
            { columnIndex: 0, field: "client.phone", vaccineName: null, confidence: "high", reason: "Telefon biçimi" },
            { columnIndex: 1, field: "client.firstName", vaccineName: null, confidence: "medium", reason: "Ad biçiminde" },
          ],
        };
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await mount(
      [
        ["Kolon1", "Kolon2", "Hayvan"],
        ["0532 111 22 33", "Ayşe", "Pamuk"],
        ["0533 222 33 44", "Mehmet", "Boncuk"],
      ],
      true,
    );
    await screen.findByText(tr.import.aiPrivacy);
    expect((document.querySelector("#import-column-0") as HTMLSelectElement).value).toBe("client.phone");
    // Unsure: proposed, not applied.
    expect((document.querySelector("#import-column-1") as HTMLSelectElement).value).toBe("");
    expect(screen.getByText("Ad biçiminde")).toBeInTheDocument();
  });
});
