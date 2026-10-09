import { describe, expect, it } from "vitest";
import type { Day, Garment } from "../types";
import {
  activeItemsOverTime,
  dailyCost,
  divestedAverages,
  rollingMean,
  quantile,
  inventoryValueOverTime,
  totalInventoryValueOverTime,
  valueOn,
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

describe("activeItemsOverTime", () => {
  const a = garment({ id: "a", purchased: "2018-01-02", divested: "2018-01-03" });
  const b = garment({ id: "b", purchased: "2017-05-01" });
  const shirt = garment({ id: "s", category: "Shirts", purchased: "2018-01-04" });
  const range = { from: "2018-01-01", to: "2018-01-06" };

  it("steps up on purchase and down the day after divesting", () => {
    const [jackets, shirts] = activeItemsOverTime([a, b, shirt], range);
    expect(jackets.category).toBe("Jackets and hoodies");
    expect(jackets.points).toEqual([
      { date: "2018-01-01", value: 1 },
      { date: "2018-01-02", value: 2 },
      { date: "2018-01-04", value: 1 },
      { date: "2018-01-06", value: 1 },
    ]);
    expect(shirts.points).toEqual([
      { date: "2018-01-01", value: 0 },
      { date: "2018-01-04", value: 1 },
      { date: "2018-01-06", value: 1 },
    ]);
  });

  it("agrees with isActive on every day", () => {
    const [jackets] = activeItemsOverTime([a, b], range);
    for (const date of ["2018-01-01", "2018-01-02", "2018-01-03", "2018-01-04", "2018-01-05", "2018-01-06"])
      expect(valueOn(jackets.points, date)).toBe([a, b].filter((g) => isActive(g, date)).length);
  });
});

describe("inventory value over time", () => {
  const a = garment({ id: "a", price: 10.1, purchased: "2018-01-02", divested: "2018-01-03" });
  const b = garment({ id: "b", price: 20.2, purchased: "2017-05-01" });
  const shirt = garment({ id: "s", category: "Shirts", price: 0.7, purchased: "2018-01-04" });
  const range = { from: "2018-01-01", to: "2018-01-06" };

  it("sums prices of active garments per category, in whole cents", () => {
    const [jackets] = inventoryValueOverTime([a, b, shirt], range);
    expect(jackets.points.map((p) => p.value)).toEqual([20.2, 30.3, 20.2, 20.2]);
  });

  it("sums all categories for the total", () => {
    const total = totalInventoryValueOverTime([a, b, shirt], range);
    expect(valueOn(total, "2018-01-02")).toBe(30.3);
    expect(valueOn(total, "2018-01-05")).toBe(20.9);
  });
});

describe("dailyCost", () => {
  // shirt: 30 €, worn 3 times; jacket: 100 €, worn twice, divested on 2018-01-03
  const shirt = garment({ id: "shirt", category: "Shirts", price: 30 });
  const jacket = garment({ id: "jacket", price: 100, divested: "2018-01-03" });
  const days: Day[] = [
    { date: "2018-01-01", worn: ["shirt", "jacket"] },
    { date: "2018-01-02", worn: ["jacket"] },
    { date: "2018-01-03", worn: ["shirt"] },
    { date: "2018-01-04", worn: ["shirt", "jacket"] }, // jacket after divesting: ignored
  ];
  const range = { from: "2018-01-01", to: "2018-01-04" };

  it("sums lifetime cost per wear of the garments worn each day (D-2)", () => {
    expect(dailyCost([shirt, jacket], days, range).map((p) => [p.date, p.cost, p.final])).toEqual([
      ["2018-01-01", 10 + 50, false],
      ["2018-01-02", 50, true],
      ["2018-01-03", 10, false],
      ["2018-01-04", 10, false],
    ]);
  });

  it("computes values as known on a date with asOf", () => {
    const asOf = dailyCost([shirt, jacket], days, range, "2018-01-02");
    expect(asOf.map((p) => [p.date, p.cost, p.final])).toEqual([
      ["2018-01-01", 30 + 50, false], // shirt worn once so far; jacket not yet divested
      ["2018-01-02", 50, false],
    ]);
  });
});

describe("rollingMean", () => {
  it("centres a 30-value window on values i-14 … i+15", () => {
    const values = Array.from({ length: 40 }, (_, i) => i);
    const out = rollingMean(values, 30);
    expect(out[13]).toBeNull();
    expect(out[14]).toBe((0 + 29) / 2); // mean of 0…29
    expect(out[24]).toBe((10 + 39) / 2); // mean of 10…39
    expect(out[25]).toBeNull();
  });
});

describe("quantile", () => {
  it("interpolates like R's quantile() (type 7)", () => {
    const v = [1, 2, 3, 4, 10];
    expect(quantile(v, 0.05)).toBeCloseTo(1.2); // R: quantile(c(1,2,3,4,10), 0.05) = 1.2
    expect(quantile(v, 0.32)).toBeCloseTo(2.28);
    expect(quantile(v, 0.95)).toBeCloseTo(8.8);
    expect(quantile([], 0.5)).toBeNull();
  });
});

describe("itemListing as of a date", () => {
  const shirt = garment({ id: "shirt", category: "Shirts", price: 30, divested: "2018-01-03" });
  const days: Day[] = [
    { date: "2018-01-01", worn: ["shirt"] },
    { date: "2018-01-02", worn: ["shirt"] },
    { date: "2018-01-03", worn: ["shirt"] },
  ];
  const range = { from: "2018-01-01", to: "2018-01-31" };

  it("uses only wears up to asOf and is active until divested", () => {
    const [then] = itemListing([shirt], days, range, "2018-01-02");
    expect([then.timesWorn, then.lifetimeWears, then.costPerWear, then.active]).toEqual([2, 2, 15, true]);
    const [now] = itemListing([shirt], days, range);
    expect([now.timesWorn, now.lifetimeWears, now.costPerWear, now.active]).toEqual([3, 3, 10, false]);
  });

  it("averages divested items owned at least 30 days", () => {
    const long = garment({ id: "long", price: 100, purchased: "2018-01-01", divested: "2018-03-01" });
    const longDays: Day[] = Array.from({ length: 10 }, (_, i) => ({ date: `2018-01-${String(i + 1).padStart(2, "0")}`, worn: ["long"] }));
    const rows = itemListing([long, shirt], longDays, { from: "2018-01-01", to: "2018-12-31" });
    const avg = divestedAverages(rows)!; // shirt (3 days owned) left out
    expect(avg.costPerWear).toBe(10);
    expect(avg.wearsPerMonth).toBeCloseTo((10 / 60) * 30.5);
  });
});
