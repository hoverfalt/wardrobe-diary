// Compares the metrics with the live wardrobediary.io tables. Needs the git-ignored reference data
// (see reference/README.md), so it is skipped on machines that don't have it.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Day, Garment } from "../types";
import { categoryListing, itemListing, TRACKING_START } from "./metrics";

const SHEET = "../reference/sheet.json";
const LIVE = "../reference/live/portfolio.csv";
// The live snapshot's "Days used" shares all fit 3,168 days since 2018-01-01.
const LIVE_SNAPSHOT_DATE = "2026-09-03";

const haveData = existsSync(SHEET) && existsSync(LIVE);

// Where the live site is wrong, not the port (both are bugs in the old R pipeline):
const KNOWN_LIVE_ERRORS: Record<string, string> = {
  // R matched items by name; four boxers share their names with other Sheet rows and were dropped.
  "Underwear boxers": "R dropped Urban Classics dark camo 07–10 (duplicate item names)",
  // The live category row is 210 € above the sum of the live Sportswear item table.
  Sportswear: "live category row disagrees with the live item table",
};

const LIVE_ITEM_TABLES = [
  "jackets", "blazers", "knits", "shirts", "t-shirts", "pants", "shorts",
  "belts", "socks", "shoes", "uw_shirts", "uw_boxers", "sportswear",
];

function readCsv(path: string): Record<string, string>[] {
  const [header, ...lines] = readFileSync(path, "utf8").trim().split(/\r?\n/).map(parseCsvLine);
  return lines.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i]])));
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

describe.skipIf(!haveData)("category listing vs live site", () => {
  const sheet = haveData ? JSON.parse(readFileSync(SHEET, "utf8")) : { garments: [], days: {} };
  const garments: Garment[] = sheet.garments;
  const days: Day[] = Object.entries(sheet.days as Record<string, string[]>).map(([date, worn]) => ({ date, worn }));
  const ours = categoryListing(garments, days, { from: TRACKING_START, to: LIVE_SNAPSHOT_DATE });

  const live = haveData
    ? readFileSync(LIVE, "utf8")
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((line) => {
          const [category, ...nums] = line.split(",");
          const [activeItems, inventoryValue, costPerWear, daysUsed, yearlyCost, turnover] = nums.map((v) =>
            v === "" ? null : Number(v),
          );
          return { category, activeItems, inventoryValue, costPerWear, daysUsed, yearlyCost, turnover };
        })
    : [];

  const comparable = live.filter((r) => r.category !== "Total" && !KNOWN_LIVE_ERRORS[r.category]);
  it.each(comparable.map((r) => [r.category, r]))("%s", (category, l) => {
    const o = ours.find((r) => r.category === category);
    expect(o, `category ${category} missing`).toBeDefined();
    const report = { category, live: l, ours: o };
    // Tolerances: the Sheet has changed a little since the snapshot (dates, late-logged days).
    expect(Math.abs(o!.activeItems - l.activeItems!), JSON.stringify(report)).toBeLessThanOrEqual(1);
    expect(o!.daysUsed!).toBeCloseTo(l.daysUsed!, 2);
    expect(relErr(o!.costPerWear!, l.costPerWear!), JSON.stringify(report)).toBeLessThan(0.02);
    expect(relErr(o!.yearlyCost!, l.yearlyCost!), JSON.stringify(report)).toBeLessThan(0.02);
  });
});

describe.skipIf(!haveData)("item listings vs live site", () => {
  const sheet = haveData ? JSON.parse(readFileSync(SHEET, "utf8")) : { garments: [], days: {} };
  const garments: Garment[] = sheet.garments;
  const days: Day[] = Object.entries(sheet.days as Record<string, string[]>).map(([date, worn]) => ({ date, worn }));
  const rows = itemListing(garments, days, { from: TRACKING_START, to: LIVE_SNAPSHOT_DATE });
  const nameCount = new Map<string, number>();
  for (const g of garments) nameCount.set(g.item, (nameCount.get(g.item) ?? 0) + 1);
  const byName = new Map(rows.filter((r) => nameCount.get(r.garment.item) === 1).map((r) => [r.garment.item, r]));

  it.each(LIVE_ITEM_TABLES)("%s", (table) => {
    const mismatches: string[] = [];
    for (const l of readCsv(`../reference/live/${table}.csv`)) {
      if ((nameCount.get(l.Item) ?? 0) > 1) continue; // ambiguous in R too
      const o = byName.get(l.Item);
      if (!o) {
        mismatches.push(`${l.Item}: missing`);
        continue;
      }
      // Wears logged after the snapshot make ours slightly higher.
      const worn = o.timesWorn - Number(l["Times worn"]);
      if (o.garment.price !== Math.round(Number(l.Price) * 100) / 100 || worn < 0 || worn > 3 || o.active !== (l.Status === "Active"))
        mismatches.push(`${l.Item}: live ${l.Price} € ${l["Times worn"]}× ${l.Status}; ours ${o.garment.price} € ${o.timesWorn}× ${o.active ? "Active" : "Divested"}`);
    }
    expect(mismatches).toEqual([]);
  });
});

function relErr(a: number, b: number) {
  return Math.abs(a - b) / Math.abs(b);
}
