import { describe, expect, it } from "vitest";
import type { Garment } from "../types";
import { companions, wornTogether } from "./combinations";

const g = (id: string, category: string, purchased = "2020-01-01", divested: string | null = null): Garment => ({
  id, category, item: id, details: "", photo: "", price: 10, purchased, divested, timesUsedInit: 0, materials: "", weightG: null,
});
const G = [g("jacket1", "Jackets"), g("jacket2", "Jackets"), g("jeans", "Pants"), g("shoes", "Shoes", "2020-01-01", "2020-01-02")];
const days = [
  { date: "2020-01-01", worn: ["jacket1", "jeans", "shoes"] },
  { date: "2020-01-02", worn: ["jacket1", "jacket2", "jeans"] },
  { date: "2020-01-03", worn: ["jacket2", "jeans", "shoes"] }, // shoes divested the day before: ignored
  { date: "2020-01-04", worn: ["jeans"] },
];
const all = { from: "2020-01-01", to: "2020-12-31" };

describe("worn together", () => {
  it("counts days worn and pairs symmetrically, within ownership", () => {
    const wt = wornTogether(G, days, all);
    expect(wt.wears.get("jeans")).toBe(4);
    expect(wt.wears.get("shoes")).toBe(1);
    expect(wt.pairs.get("jacket1")!.get("jeans")).toBe(2);
    expect(wt.pairs.get("jeans")!.get("jacket1")).toBe(2);
    expect(wt.pairs.get("jacket2")!.get("shoes")).toBeUndefined();
    expect(wt.pairs.get("jacket1")!.get("jacket2")).toBe(1);
  });

  it("follows the date range", () => {
    const wt = wornTogether(G, days, { from: "2020-01-02", to: "2020-01-03" });
    expect(wt.pairs.get("jacket1")!.get("jeans")).toBe(1);
    expect(wt.wears.has("shoes")).toBe(false);
  });

  it("lists companions of a set, counting each day once and leaving out the set's own garments", () => {
    const r = companions(new Set(["jacket1", "jacket2"]), G, days, all);
    expect(r.subjectDays).toBe(3);
    expect(r.companions).toEqual([
      { id: "jeans", days: 3, shareOfItsWears: 0.75 },
      { id: "shoes", days: 1, shareOfItsWears: 1 },
    ]);
    expect(companions(new Set(["jacket1"]), G, days, all).companions.map((c) => c.id)).toEqual(["jeans", "jacket2", "shoes"]);
  });
});
