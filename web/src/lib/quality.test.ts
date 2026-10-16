import { describe, expect, it } from "vitest";
import type { Garment } from "../types";
import type { PublicData } from "./publicData";
import { publicMatchesSource, runQuality } from "./quality";

const g = (over: Partial<Garment>): Garment => ({
  id: "Shirts-001", category: "Shirts", item: "Shirt", details: "", photo: "Shirts-001", price: 50,
  purchased: "2019-01-01", divested: null, timesUsedInit: 0, materials: "100% cotton", weightG: 200, ...over,
});
const ids = ["unique-ids", "known-category", "dates-ordered", "non-negative", "known-tags", "worn-exists", "wears-in-ownership", "public-matches-source", "materials-coverage"];
const status = (data: PublicData) => Object.fromEntries(runQuality(data, ids, "2026-01-01").map((r) => [r.id, r.status]));

describe("data quality checks", () => {
  it("passes clean data", () => {
    const data: PublicData = { version: 1, garments: [g({})], days: { "2019-02-01": [0] } };
    expect(status(data)).toEqual({
      "unique-ids": "pass", "known-category": "pass", "dates-ordered": "pass", "non-negative": "pass", "known-tags": "pass",
      "worn-exists": "pass", "wears-in-ownership": "pass", "public-matches-source": "not-checked", "materials-coverage": "info",
    });
  });

  it("catches each kind of problem", () => {
    const data: PublicData = {
      version: 1,
      garments: [
        g({}), g({ category: "Hats" }), g({ id: "x", purchased: "2020-01-01", divested: "2019-01-01" }),
        g({ id: "y", price: -1 }), g({ id: "z", tags: ["vintage"] }),
      ],
      days: { "2018-06-01": [0], "2019-03-01": [7], "2019-03-02": [0, 0] },
    };
    const s = status(data);
    for (const id of ["unique-ids", "known-category", "dates-ordered", "non-negative", "known-tags", "worn-exists"]) expect(s[id], id).toBe("fail");
    expect(s["wears-in-ownership"]).toBe("warn"); // worn on 2018-06-01, bought 2019-01-01
  });

  it("compares the public copy with a backup", () => {
    const data: PublicData = { version: 1, garments: [g({})], days: { "2019-02-01": [0] } };
    const { id: _id, ...fields } = g({});
    expect(publicMatchesSource(data, { garments: { "Shirts-001": fields }, days: { "2019-02-01": ["Shirts-001"] } }).status).toBe("pass");
    expect(publicMatchesSource(data, { garments: { "Shirts-001": { ...fields, price: 60 } }, days: {} }).count).toBe(2);
    // Key order doesn't matter (Firestore and the backups order keys differently)
    const withComparison: PublicData = { ...data, comparison: [{ id: "hsl", type: "", item: "HSL", details: "", photo: "", monthlyCost: 60, useFrequency: 0.9 }] };
    const items = [{ useFrequency: 0.9, monthlyCost: 60, photo: "", details: "", item: "HSL", type: "", id: "hsl" }];
    expect(publicMatchesSource(withComparison, { garments: { "Shirts-001": fields }, days: { "2019-02-01": ["Shirts-001"] }, settings: { comparison: { items } } }).status).toBe("pass");
  });
});
