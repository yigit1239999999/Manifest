// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import tr from "@/messages/tr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ImportBatches, type ImportBatchRow } from "@/components/import/import-batches";

/**
 * The list of earlier imports, at the two things the source can be wrong
 * about.
 *
 * ONE: an empty list is not a card with nothing in it. A clinic that has
 * never imported anything has no reason to be told about a list, so the
 * component renders nothing at all -- and that is a decision worth holding,
 * because "Earlier imports" over an empty box reads as a feature that broke.
 *
 * TWO: the file name. It is the vet's own string and it is the one line on
 * the row with no spaces in it; `musteri_hayvan_kayitlari_yedek_2019_2024_
 * son_hali.xlsx` is what a backup is actually called, and CSS offers a line
 * break at a hyphen but never at an underscore.
 *
 * What this file cannot say: jsdom has no layout engine, so it cannot see
 * pixels. The geometry was measured in a browser at 390px on the production
 * build (`a259d5c`, BUILD_ID `gjVP1tYtGLpOwEkqIpdPQ`): the paragraph's box
 * was 218px wide, its text 388px, and the page carried 116px of sideways
 * scroll -- in TR and EN, light and dark, all four the same, because the
 * string that overflows is the vet's, not a translation. The class is what
 * lives in the source, so the class is what is checked here.
 */
const row = (over: Partial<ImportBatchRow> = {}): ImportBatchRow => ({
  id: "b1",
  fileName: "musteri_hayvan_kayitlari_yedek_2019_2024_son_hali.xlsx",
  summary: "12 müşteri, 15 hayvan",
  merged: null,
  by: "Ayşe Yılmaz · 24.09.2026 10:12",
  undone: false,
  ...over,
});

function mount(batches: ImportBatchRow[], canUndo = true) {
  return render(
    <NextIntlClientProvider locale="tr" messages={tr}>
      <ImportBatches batches={batches} canUndo={canUndo} />
    </NextIntlClientProvider>,
  );
}

describe("the list of earlier imports", () => {
  it("draws nothing at all when the clinic has never imported", () => {
    const { container } = mount([]);
    expect(container.firstChild).toBeNull();
  });

  it("lets a file name with no spaces in it break inside the word", () => {
    mount([row()]);
    const name = screen.getByText(
      "musteri_hayvan_kayitlari_yedek_2019_2024_son_hali.xlsx",
    );
    expect(name.className).toContain("break-words");
  });

  it("offers the way back on a batch that is still standing, and not on one already undone", () => {
    mount([row(), row({ id: "b2", undone: true })]);
    // One button, not two: an import that has been taken back cannot be
    // taken back again, and the row says so in words instead.
    expect(screen.getAllByRole("button", { name: tr.import.undoButton })).toHaveLength(1);
    expect(screen.getByText(tr.import.batchUndone)).toBeInTheDocument();
  });

  it("offers no way back to someone who may not take an import back (A5)", () => {
    mount([row()], false);
    expect(screen.queryByRole("button", { name: tr.import.undoButton })).toBeNull();
    expect(screen.getByText(tr.import.batchesHintNoUndo)).toBeInTheDocument();
  });

  it("asks with the server's counts before deleting anything", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        preview: {
          clientCount: 12,
          petCount: 30,
          vaccinationCount: 45,
          keptClients: 1,
          keptPets: 2,
          keptVaccinations: 0,
          editedPets: ["Boncuk"],
          editedClients: [],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    // jsdom has no modal dialog; the call is what matters here.
    HTMLDialogElement.prototype.showModal = vi.fn();
    mount([row()]);
    screen.getByRole("button", { name: tr.import.undoButton }).click();
    await screen.findByText(/12 sahip, 30 hayvan ve 45 aşı kaydı silinecek/);
    expect(screen.getByText(/Boncuk/)).toBeInTheDocument();
    // Only the preview went out: nothing is deleted before the answer.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ batchId: "b1", preview: true });
    vi.unstubAllGlobals();
  });
});
