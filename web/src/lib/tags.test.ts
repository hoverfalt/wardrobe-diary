import { describe, expect, it } from "vitest";
import { hasTag, secondHandFromName, tagsOf } from "./tags";

describe("tags", () => {
  it("reads (SH) from names", () => {
    expect(secondHandFromName("Barbour Classic Tartan navy (SH)")).toEqual({ item: "Barbour Classic Tartan navy", secondHand: true });
    expect(secondHandFromName("North Bend black vest")).toEqual({ item: "North Bend black vest", secondHand: false });
    expect(secondHandFromName("Shorts (Hanko)")).toEqual({ item: "Shorts (Hanko)", secondHand: false });
  });

  it("lists known tags only", () => {
    expect(tagsOf({ tags: ["unknown", "second-hand"] })).toEqual(["second-hand"]);
    expect(hasTag({}, "second-hand")).toBe(false);
  });
});
