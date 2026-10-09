import { describe, expect, it } from "vitest";
import type { Day, Garment } from "../types";
import {
  categoryListing,
  costPerWear,
  daysOwned,
  isActive,
  itemListing,
  timesWorn,
  wearIndex,
  type DateRange,
} from "./metrics";

const garment = (over: Partial<Garment>): Garment => ({
  id: "g",
  category: "Jackets and hoodies",
  item: "",
  details: "",
  photo: "",
  price: 100,
  purchased: "2018-01-01",
  divested: null,
  timesUsedInit: 0,
  materials: "",
  weightG: null,
  ...over,
});

const vest = garment({ id: "vest", price: 50, timesUsedInit: 2, purchased: "2017-07-01" });
const warmer = garment({ id: "warmer", price: 150, divested: "2018-01-02" });
const days: Day[] = [
  { date: "2018-01-01", worn: ["vest"] },
  { date: "2018-01-02", worn: ["vest", "warmer"] },
  { date: "2018-01-03", worn: ["warmer"] }, // after divesting: ignored
];
const all: DateRange = { from: "2018-01-01", to: "2018-01-04" };
const wears = wearIndex(days);

describe("garment metrics", () => {
  it("counts times worn including pre-tracking wears, ignoring wears outside ownership", () => {
    expect(timesWorn(vest, wears, all)).toBe(4);
    expect(timesWorn(warmer, wears, all)).toBe(1);
  });

  it("counts pre-tracking wears only when the range starts at the start of tracking", () => {
    expect(timesWorn(vest, wears, { from: "2018-01-02", to: "2018-01-04" })).toBe(1);
  });

  it("computes cost per wear over the whole ownership; unworn garments cost their full price", () => {
    expect(costPerWear(vest, wears)).toBe(12.5);
    expect(costPerWear(garment({ id: "unworn" }), wears)).toBe(100);
  });

  it("computes cost per wear independently of any range, including wears after it (D-2)", () => {
    const [v] = itemListing([vest], days, { from: "2018-01-01", to: "2018-01-01" });
    expect(v.timesWorn).toBe(3); // 2 pre-tracking + 1 in range
    expect(v.costPerWear).toBe(12.5); // 50 € / all 4 wears
  });

  it("treats the divest day as still owned", () => {
    expect(isActive(warmer, "2018-01-02")).toBe(true);
    expect(isActive(warmer, "2018-01-03")).toBe(false);
    expect(isActive(vest, "2018-01-01")).toBe(true); // purchased before tracking: owned from its start
  });

  it("counts days owned from purchase, frozen at the divest date", () => {
    expect(daysOwned(warmer, all)).toBe(2);
    expect(daysOwned(vest, { from: "2018-01-01", to: "2018-01-01" })).toBe(185); // 2017-07-01 … 2018-01-01
  });

  it("lists items with wears per month", () => {
    const [v] = itemListing([vest], days, all);
    expect(v.timesWorn).toBe(4);
    expect(v.wearsPerMonth).toBeCloseTo(4 / ((daysOwned(vest, all)) / 30.5));
    expect(v.active).toBe(true);
  });
});

describe("categoryListing", () => {
  const [total, jackets] = categoryListing([vest, warmer], days, all);

  it("summarises a category", () => {
    expect(jackets.activeItems).toBe(1); // warmer divested before range end
    expect(jackets.inventoryValue).toBe(50);
    expect(jackets.costPerWear).toBe((12.5 * 4 + 150 * 1) / 5); // use-weighted average cost per wear
    expect(jackets.daysUsed).toBe(2 / 4);
    expect(jackets.yearlyCost).toBe(40 * 365 * 0.5);
    expect(jackets.turnover).toBe((40 * 365 * 0.5) / 50);
  });

  it("averages cost per wear over garments worn in the range, weighted by wears in the range (D-2)", () => {
    const unworn = garment({ id: "unworn", price: 1000 });
    const [, c] = categoryListing([vest, warmer, unworn], days, { from: "2018-01-02", to: "2018-01-02" });
    expect(c.costPerWear).toBe((12.5 * 1 + 150 * 1) / 2); // unworn garment left out
  });

  it("adds a total row", () => {
    expect(total.category).toBe("Total");
    expect(total.activeItems).toBe(1);
    expect(total.yearlyCost).toBe(jackets.yearlyCost);
  });
});
