import { describe, expect, it } from "vitest";
import type { Garment } from "../types";
import { decodePublicData, withGarments, withoutGarment } from "./publicData";

const g = (id: string) => ({ id }) as Garment;

describe("decodePublicData", () => {
  it("turns garment indexes back into ids and sorts days", () => {
    const w = decodePublicData({
      version: 1,
      garments: [g("a"), g("b")],
      days: { "2018-01-02": [1], "2018-01-01": [0, 1] },
    });
    expect(w.days).toEqual([
      { date: "2018-01-01", worn: ["a", "b"] },
      { date: "2018-01-02", worn: ["b"] },
    ]);
  });
});

describe("editing public data", () => {
  const data = {
    version: 1 as const,
    garments: [g("a"), g("b"), g("c")],
    days: { "2018-01-01": [0, 2], "2018-01-02": [1], "2018-01-03": [2] },
  };

  it("removes a garment and shifts the indexes after it", () => {
    const out = withoutGarment(data, "b");
    expect(out.garments.map((x) => x.id)).toEqual(["a", "c"]);
    expect(out.days).toEqual({ "2018-01-01": [0, 1], "2018-01-03": [1] }); // day with only "b" dropped
    expect(decodePublicData(out).days.map((d) => d.worn)).toEqual([["a", "c"], ["c"]]);
  });

  it("replaces garments in place", () => {
    const out = withGarments(data, [{ ...g("c"), item: "renamed" } as Garment]);
    expect(out.garments[2].item).toBe("renamed");
    expect(out.days).toBe(data.days);
  });
});
