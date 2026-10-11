import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Day, Garment } from "../types";
import { fibreClass, materialBreakdown, materialsByMonth, materialsIssue, parseMaterials } from "./materials";

const main = (t: string) => parseMaterials(t).main.map((c) => [c.fibre, Math.round(c.share * 100)]);

describe("parseMaterials", () => {
  it("reads simple compositions, with any separator and capitalisation", () => {
    expect(main("95% cotton\n5% elastane")).toEqual([["cotton", 95], ["elastane", 5]]);
    expect(main("95% Cotton, 5% Elastane")).toEqual([["cotton", 95], ["elastane", 5]]);
    expect(main("71% cotton, 27% polyester ja 2% elastane")).toEqual([["cotton", 71], ["polyester", 27], ["elastane", 2]]);
    expect(main("98,5% cotton, 1,5% lycra")).toEqual([["cotton", 99], ["elastane", 2]]); // decimal commas; 98.5 → 99
  });

  it("normalises typos and synonyms", () => {
    expect(main("82% coton, 17% poilyamide, 1% elastan")).toEqual([["cotton", 82], ["polyamide", 17], ["elastane", 1]]);
    expect(main("60% cotton, 35% lycocell/tencel, 5% elastane/lycra")).toEqual([["cotton", 60], ["lyocell", 35], ["elastane", 5]]);
    expect(main("45% Merino wool, 45% Endurofil / Polyproylene, 9 % Nylon / Polyamide, 1% Lycra / Elastane"))
      .toEqual([["wool", 45], ["polypropylene", 45], ["polyamide", 9], ["elastane", 1]]);
  });

  it("keeps organic and recycled as flags", () => {
    const p = parseMaterials("100% cotton (organic)").main[0];
    expect([p.fibre, p.organic, p.recycled]).toEqual(["cotton", true, false]);
    expect(parseMaterials("88% polyester-recycled, 12% elastane").main[0]).toMatchObject({ fibre: "polyester", recycled: true });
  });

  it("uses the main part of multi-part garments", () => {
    const p = parseMaterials("Shell: 55% wool, 35% polyester, 10% polyamide; Lining: 100% viscose");
    expect(p.parts.map((x) => x.label)).toEqual(["shell", "lining"]);
    expect(main("Shell: 55% wool, 35% polyester, 10% polyamide; Lining: 100% viscose")).toEqual([["wool", 55], ["polyester", 35], ["polyamide", 10]]);
    expect(main("Fabric 100% linen; Lining 65% polyester, 35% cotton; padding 90% down, 10% feather")).toEqual([["linen", 100]]);
    expect(parseMaterials("Padding: 100% polyester; Shell: 100% polyamide").mainLabel).toBe("shell"); // not the first part
    expect(parseMaterials("Shell and lining: 100% polyamide, Padding 100% polyester").parts.map((x) => x.label)).toEqual(["shell & lining", "padding"]);
    expect(main("Padding: 50% polyester-recycled, 50% polyester. Sheel and lining: 100% polyester-recycled.")).toEqual([["polyester", 100]]);
  });

  it("splits equally and flags an estimate when no percentages are given", () => {
    const p = parseMaterials("Leather, textile, rubber");
    expect(p.estimated).toBe(true);
    expect(main("Leather, textile, rubber")).toEqual([["leather", 33], ["textile", 33], ["rubber", 33]]);
    expect(parseMaterials("50% cottong, 35% lyocell, 5% elastane").estimated).toBe(true); // sums to 90 %
  });

  it("treats NA and empty as unknown, and reports unknown words", () => {
    expect(parseMaterials("NA (bleeched)").main).toEqual([]);
    expect(parseMaterials("").main).toEqual([]);
    expect(parseMaterials("80% cotton, 20% unobtainium").unknown).toEqual(["unobtainium"]);
  });

  // All texts in the latest backup read without unknown words (skipped where the backup isn't available).
  const BACKUP = "../../wardrobe-diary-backups/wardrobe.json";
  it.skipIf(!existsSync(BACKUP))("reads every materials text in the data", () => {
    const garments = Object.values(JSON.parse(readFileSync(BACKUP, "utf8")).garments as Record<string, { materials: string }>);
    const problems = garments.map((g) => g.materials).filter((t) => t && parseMaterials(t).unknown.length > 0);
    expect(problems).toEqual([]);
  });
});

describe("materialBreakdown", () => {
  const g = (over: Partial<Garment>): Garment => ({
    id: "g", category: "Shirts", item: "", details: "", photo: "", price: 10, purchased: "2018-01-01",
    divested: null, timesUsedInit: 0, materials: "", weightG: null, ...over,
  });
  const shirt = g({ id: "s", materials: "80% cotton, 20% polyester-recycled", weightG: 200 });
  const socks = g({ id: "k", category: "Socks", materials: "100% cotton", weightG: 50 });
  const noWeight = g({ id: "n", materials: "100% wool" });
  const days: Day[] = [
    { date: "2018-01-01", worn: ["s", "k"] },
    { date: "2018-01-02", worn: ["s", "n"] },
  ];
  const range = { from: "2018-01-01", to: "2018-01-02" };

  it("adds up owned fibre mass from weight × composition", () => {
    const b = materialBreakdown([shirt, socks, noWeight], days, range, "owned");
    expect(b.totalKg).toBeCloseTo(0.25);
    expect(b.fibres.map((f) => [f.fibre, Math.round(f.kg * 1000)])).toEqual([["cotton", 210], ["polyester", 40]]);
    expect(b.fibres[1].recycledKg).toBeCloseTo(0.04);
    expect(b.coverage).toEqual({ included: 2, total: 3, missingWeight: 1, missingMaterials: 0, estimated: 0 });
  });

  it("counts each wear for the worn basis, with the average outfit weight", () => {
    const b = materialBreakdown([shirt, socks, noWeight], days, range, "worn");
    expect(b.totalKg).toBeCloseTo(0.45); // shirt twice, socks once
    expect(b.coverage).toMatchObject({ included: 3, total: 4, missingWeight: 1 });
    expect(b.averageOutfitKg).toBeCloseTo((0.25 + 0.2) / 2);
  });
});

describe("fibre classes, monthly figures and review issues", () => {
  it("classifies fibres", () => {
    expect(["cotton", "lyocell", "polyester", "rubber"].map(fibreClass)).toEqual(["natural", "regenerated", "synthetic", "other"]);
  });

  it("computes outfit weight and synthetic share per month", () => {
    const g = (over: Partial<Garment>): Garment => ({
      id: "g", category: "Shirts", item: "", details: "", photo: "", price: 10, purchased: "2018-01-01",
      divested: null, timesUsedInit: 0, materials: "", weightG: null, ...over,
    });
    const tee = g({ id: "t", materials: "50% cotton, 50% polyester", weightG: 200 });
    const shoe = g({ id: "s", materials: "Leather, rubber", weightG: 800 });
    const months = materialsByMonth([tee, shoe], [
      { date: "2018-01-01", worn: ["t", "s"] },
      { date: "2018-01-02", worn: ["t"] },
      { date: "2018-02-01", worn: ["s"] },
    ], { from: "2018-01-01", to: "2018-02-28" });
    expect(months.map((m) => [m.month, m.averageOutfitKg])).toEqual([["2018-01", 0.6], ["2018-02", 0.8]]);
    expect(months[0].syntheticShare).toBeCloseTo(0.2 / 1.2); // 2 × 0.1 kg polyester of 1.2 kg
  });

  it("flags materials texts to review", () => {
    expect(["95% cotton, 5% elastane", "Leather, rubber", "NA", "80% cotton, 20% unobtainium"].map(materialsIssue))
      .toEqual([null, "estimated", "missing", "unreadable"]);
  });
});
