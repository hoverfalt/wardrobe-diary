import { describe, expect, it } from "vitest";
import type { Day, Garment } from "../types";
import { categorySummary, costPerWear, isActive, timesUsed, wearCounts } from "./metrics";

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
const warmer = garment({ id: "warmer", price: 149, divested: "2018-01-03" });
const days: Day[] = [
  { date: "2018-01-01", worn: ["vest"] },
  { date: "2018-01-02", worn: ["vest", "warmer"] },
];

describe("metrics", () => {
  const counts = wearCounts(days);

  it("counts times used including initial uses", () => {
    expect(timesUsed(vest, counts)).toBe(4);
    expect(timesUsed(warmer, counts)).toBe(1);
  });

  it("computes cost per wear", () => {
    expect(costPerWear(vest, counts)).toBe(12.5);
    expect(costPerWear(garment({ id: "unused" }), counts)).toBeNull();
  });

  it("knows whether a garment is active", () => {
    expect(isActive(warmer, "2018-01-02")).toBe(true);
    expect(isActive(warmer, "2018-01-03")).toBe(false);
    expect(isActive(vest, "2017-06-30")).toBe(false);
  });

  it("summarises by category", () => {
    const [s] = categorySummary([vest, warmer], days, "2018-01-02");
    expect(s.activeItems).toBe(2);
    expect(s.inventoryValue).toBe(199);
    expect(s.avgCostPerWear).toBe((12.5 + 149) / 2);
    expect(s.frequency).toBe(1);
  });
});
