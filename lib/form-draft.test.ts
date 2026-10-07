// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearDraft, readDraft, writeDraft } from "./form-draft";

const scoped = (who: string) => {
  document.body.innerHTML = `<main data-draft-scope="${who}"></main>`;
};

beforeEach(() => {
  window.sessionStorage.clear();
  scoped("u-1");
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("what a vet has typed but not saved", () => {
  it("comes back on the same tab", () => {
    writeDraft("visit:new", { chiefComplaint: "Zeytin kusuyor" });

    expect(readDraft("visit:new")).toEqual({ chiefComplaint: "Zeytin kusuyor" });
  });

  // Two vets share the machine at the counter inside one browser
  // session. Without the scope the second one to sit down is handed the
  // first one's half-written examination, in a form about a different
  // animal.
  it("is not handed to whoever signs in next", () => {
    writeDraft("visit:new", { chiefComplaint: "Zeytin kusuyor" });

    scoped("u-2");

    expect(readDraft("visit:new")).toBeNull();
  });

  // Nobody is signed in on the sign-in page, so there is no `<main
  // data-draft-scope>` and nothing may be written unscoped -- an
  // unscoped key is exactly the one everybody would read.
  it("is not written at all when nobody is signed in", () => {
    document.body.innerHTML = "";

    writeDraft("visit:new", { chiefComplaint: "Zeytin kusuyor" });

    expect(window.sessionStorage.length).toBe(0);
  });

  it("is dropped once the work is saved", () => {
    writeDraft("visit:new", { chiefComplaint: "Zeytin kusuyor" });

    clearDraft("visit:new");

    expect(readDraft("visit:new")).toBeNull();
  });

  // An untouched form is not a draft. Without this, opening a form and
  // walking away would leave a row behind that later announces "what
  // you had written has been restored" over an empty form.
  it("is not stored for a form nobody typed into", () => {
    writeDraft("visit:new", { chiefComplaint: "", subjective: "" });

    expect(readDraft("visit:new")).toBeNull();
  });

  // A new visit and an old one are different pieces of work; one key
  // for both would pour an unsaved new visit into the edit form of a
  // record that already exists.
  it("belongs to one record, not to the route", () => {
    writeDraft("visit:new", { chiefComplaint: "Zeytin kusuyor" });

    expect(readDraft("visit:v-1")).toBeNull();
  });

  it("survives a storage that refuses to answer", () => {
    const broken = () => {
      throw new Error("storage disabled");
    };
    const original = Object.getOwnPropertyDescriptor(
      window.Storage.prototype,
      "getItem",
    );
    window.Storage.prototype.getItem = broken;

    // Losing the safety net is bad; taking the form down with it is
    // worse, and a private window does exactly this.
    expect(() => readDraft("visit:new")).not.toThrow();
    expect(readDraft("visit:new")).toBeNull();

    if (original) Object.defineProperty(window.Storage.prototype, "getItem", original);
  });

  it("ignores a stored row that is not a set of strings", () => {
    window.sessionStorage.setItem("pettrack.draft.v1.u-1.visit:new", "[1,2,3]");

    expect(readDraft("visit:new")).toBeNull();
  });
});
