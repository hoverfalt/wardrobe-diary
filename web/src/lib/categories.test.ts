import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER, compareCategories } from "./categories";

describe("compareCategories", () => {
  it("sorts by the standard order, unknown categories last", () => {
    const shuffled = ["Zebra", ...[...CATEGORY_ORDER].reverse(), "Aardvark"];
    expect(shuffled.sort(compareCategories)).toEqual([...CATEGORY_ORDER, "Aardvark", "Zebra"]);
  });
});
