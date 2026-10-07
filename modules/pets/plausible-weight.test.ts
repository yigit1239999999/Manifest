import { describe, expect, it } from "vitest";
import { implausibleWeight } from "./plausible-weight";

describe("implausibleWeight", () => {
  it("flags a cat at 42 kg", () => {
    expect(implausibleWeight("CAT", "42")).toEqual({ species: "CAT", kg: 42 });
  });

  it("reads a decimal comma the way the form does", () => {
    expect(implausibleWeight("CAT", "4,2")).toBeNull();
    expect(implausibleWeight("BIRD", "2,5")).toEqual({ species: "BIRD", kg: 2.5 });
  });

  it("lets the maximum itself through", () => {
    expect(implausibleWeight("CAT", "15")).toBeNull();
    expect(implausibleWeight("DOG", "100")).toBeNull();
    expect(implausibleWeight("DOG", "100.5")).toEqual({ species: "DOG", kg: 100.5 });
  });

  it.each([
    ["RABBIT", "11"],
    ["RODENT", "3.1"],
    ["FERRET", "4"],
    ["REPTILE", "51"],
  ])("flags a %s at %s kg", (species, typed) => {
    expect(implausibleWeight(species, typed)).not.toBeNull();
  });

  it("does not check species without a row", () => {
    expect(implausibleWeight("HORSE", "600")).toBeNull();
    expect(implausibleWeight("OTHER", "42")).toBeNull();
    expect(implausibleWeight(null, "42")).toBeNull();
    expect(implausibleWeight(undefined, "42")).toBeNull();
  });

  it("stays quiet on an empty or unreadable box", () => {
    expect(implausibleWeight("CAT", "")).toBeNull();
    expect(implausibleWeight("CAT", "  ")).toBeNull();
    expect(implausibleWeight("CAT", "4,2,1")).toBeNull();
    expect(implausibleWeight("CAT", "abc")).toBeNull();
  });

  it("does not mistake an inherited property for a species", () => {
    expect(implausibleWeight("toString", "42")).toBeNull();
  });
});
