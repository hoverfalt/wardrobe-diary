import { describe, expect, it } from "vitest";
import type { Wardrobe } from "../../web/src/lib/publicData";
import type { Garment } from "../../web/src/types";
import { decodeFields } from "./publicData";
import { categoryTable, getGarment, getWears, inventoryOverTime, listGarments, overview, resolveRange } from "./tools";

const garment = (over: Partial<Garment>): Garment => ({
  id: "g", category: "Shirts", item: "", details: "", photo: "", price: 30, purchased: "2018-01-01",
  divested: null, timesUsedInit: 0, materials: "", weightG: null, ...over,
});
const w: Wardrobe = {
  garments: [
    garment({ id: "Shirts-001", item: "Blue shirt", photo: "Shirts-001" }),
    garment({ id: "Shirts-002", item: "Old shirt", price: 20, divested: "2018-01-02" }),
    garment({ id: "Socks-001", category: "Socks", item: "Socks", price: 5 }),
  ],
  days: [
    { date: "2018-01-01", worn: ["Shirts-001", "Shirts-002", "Socks-001"] },
    { date: "2018-01-02", worn: ["Shirts-002"] },
    { date: "2018-02-10", worn: ["Shirts-001"] },
  ],
};

describe("Firestore REST decoding", () => {
  it("decodes typed values into plain JSON", () => {
    expect(
      decodeFields({
        version: { integerValue: "1" },
        garments: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: "a" }, price: { doubleValue: 9.5 }, divested: { nullValue: null } } } }] } },
        days: { mapValue: { fields: { "2018-01-01": { arrayValue: { values: [{ integerValue: "0" }] } } } } },
      }),
    ).toEqual({ version: 1, garments: [{ id: "a", price: 9.5, divested: null }], days: { "2018-01-01": [0] } });
  });
});

describe("tools", () => {
  it("summarises the data", () => {
    const o = overview(w);
    expect(o).toMatchObject({ lastLoggedDay: "2018-02-10", loggedDays: 3, wears: 5, garments: { total: 3, active: 2, divested: 1 } });
    expect(o.categories.map((c) => c.category)).toEqual(["Shirts", "Socks"]); // standard order
  });

  it("defaults and validates ranges", () => {
    expect(resolveRange(w)).toEqual({ from: "2018-01-01", to: "2018-02-10" });
    expect(() => resolveRange(w, "2019-01-01", "2018-01-01")).toThrow();
    expect(() => resolveRange(w, "1.1.2018")).toThrow();
  });

  it("returns the category listing", () => {
    const shirts = categoryTable(w, resolveRange(w)).rows.find((r) => r.category === "Shirts")!;
    expect(shirts).toMatchObject({ activeItems: 1, inventoryValueEur: 30, costPerWearEur: 12.5 }); // (15·2 + 10·2) / 4
  });

  it("lists, filters and sorts garments", () => {
    const r = listGarments(w, { range: resolveRange(w), category: "shirts", sort: "cost_per_wear" });
    expect(r.garments.map((g) => [g.id, g.costPerWearEur, g.status])).toEqual([["Shirts-001", 15, "active"], ["Shirts-002", 10, "divested"]]);
    expect(listGarments(w, { range: resolveRange(w), status: "divested" }).total).toBe(1);
  });

  it("finds a garment by id or name", () => {
    const g = getGarment(w, "blue shirt");
    expect(g).toMatchObject({ id: "Shirts-001", lifetimeWears: 2, firstLoggedWear: "2018-01-01", loggedWearsByYear: { 2018: 2 } });
    expect(g.photoUrl).toContain("Shirts-001.png");
    expect(() => getGarment(w, "nope")).toThrow();
  });

  it("limits day-by-day output", () => {
    expect(getWears(w, { from: "2018-01-01", to: "2018-01-31" }).days).toHaveLength(2);
    expect(() => getWears(w, { from: "2018-01-01", to: "2018-12-31" })).toThrow();
  });

  it("samples inventory at month ends", () => {
    const r = inventoryOverTime(w, { from: "2018-01-01", to: "2018-03-15" }, "items");
    expect(r.samples).toEqual([
      { date: "2018-01-31", Shirts: 1, Socks: 1 },
      { date: "2018-02-28", Shirts: 1, Socks: 1 },
      { date: "2018-03-15", Shirts: 1, Socks: 1 },
    ]);
  });
});
