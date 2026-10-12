import { describe, expect, it } from "vitest";
import { hasTag, secondHandFromName, tagsOf, tagSearchText, tagsFromName } from "./tags";

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

  it("makes tags searchable by label and badge", () => {
    expect(tagSearchText({ tags: ["motorcycle", "second-hand"] })).toBe("second hand sh motorcycle gear mc");
    expect(tagSearchText({})).toBe("");
  });

  it("turns name markers into tags", () => {
    expect(tagsFromName("Diesel gray 05 (Hanko)")).toEqual({ item: "Diesel gray 05", tags: ["hanko"] });
    expect(tagsFromName("North Bend white 01 (40-44) (Hanko) (SH)")).toEqual({ item: "North Bend white 01 (40-44)", tags: ["second-hand", "hanko"] });
    expect(tagsFromName("Jockey white 05 (ex Hanko)")).toEqual({ item: "Jockey white 05 (ex Hanko)", tags: [] });
  });
});
