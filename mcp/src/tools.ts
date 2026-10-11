// Tool logic of the Wardrobe Diary MCP server: pure functions over the public wardrobe, computed with
// the web app's own metrics.ts (bundled in), so answers match the Dashboard exactly.
import { compareCategories } from "../../web/src/lib/categories";
import { addDays, dayIndex, todayIso } from "../../web/src/lib/dates";
import {
  activeItemsOverTime,
  categoryListing,
  dailyCost,
  inventoryValueOverTime,
  isActive,
  itemListing,
  TRACKING_START,
  valueOn,
  type DateRange,
  type ItemRow,
} from "../../web/src/lib/metrics";
import { materialBreakdown, parseMaterials, type Composition } from "../../web/src/lib/materials";
import type { Wardrobe } from "../../web/src/lib/publicData";
import type { Garment } from "../../web/src/types";
import { PROJECT_ID } from "./publicData";

export const MAX_DAILY_DAYS = 92;

const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
const r3 = (v: number | null) => (v == null ? null : Math.round(v * 1000) / 1000);

export function photoUrl(g: Garment): string | null {
  if (!g.photo) return null;
  const url = `https://firebasestorage.googleapis.com/v0/b/${PROJECT_ID}.appspot.com/o/${encodeURIComponent(`${g.photo}.png`)}?alt=media`;
  return g.photoVersion ? `${url}&v=${encodeURIComponent(g.photoVersion)}` : url;
}

/** The last day with logged wears (or today if none). */
export function lastLoggedDay(w: Wardrobe): string {
  return w.days.length ? w.days[w.days.length - 1].date : todayIso();
}

/** Fills defaults and validates a date range: from 2018-01-01, to the last logged day. */
export function resolveRange(w: Wardrobe, from?: string, to?: string): DateRange {
  const range = { from: from ?? TRACKING_START, to: to ?? lastLoggedDay(w) };
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(range.from) || !iso.test(range.to)) throw new Error("Dates must be YYYY-MM-DD.");
  if (range.from > range.to) throw new Error("'from' must not be after 'to'.");
  if (range.from < TRACKING_START) range.from = TRACKING_START;
  return range;
}

export function overview(w: Wardrobe) {
  const last = lastLoggedDay(w);
  const active = w.garments.filter((g) => isActive(g, last));
  const categories = [...new Set(w.garments.map((g) => g.category))].sort(compareCategories);
  return {
    trackingStart: TRACKING_START,
    lastLoggedDay: last,
    loggedDays: w.days.length,
    wears: w.days.reduce((s, d) => s + d.worn.length, 0),
    garments: { total: w.garments.length, active: active.length, divested: w.garments.length - active.length },
    categories: categories.map((c) => ({ category: c, activeItems: active.filter((g) => g.category === c).length })),
    note: "Use the other tools with a from/to date range (YYYY-MM-DD) for metrics; see the wardrobe://definitions resource.",
  };
}

export function categoryTable(w: Wardrobe, range: DateRange) {
  return {
    range,
    rows: categoryListing(w.garments, w.days, range).map((r) => ({
      category: r.category,
      activeItems: r.activeItems,
      inventoryValueEur: r2(r.inventoryValue),
      costPerWearEur: r2(r.costPerWear),
      daysUsedShare: r3(r.daysUsed),
      yearlyCostEur: r2(r.yearlyCost),
      inventoryTurnover: r3(r.turnover),
    })),
  };
}

/** Composition as compact strings: ["cotton 95%", "elastane 5% (recycled)"]. */
function compositionText(main: Composition[]): string[] {
  return main.map((c) => `${c.fibre} ${Math.round(c.share * 100)}%${c.recycled ? " (recycled)" : ""}${c.organic ? " (organic)" : ""}`);
}

function garmentRow(r: ItemRow) {
  const g = r.garment;
  const m = parseMaterials(g.materials);
  return {
    id: g.id,
    name: g.item,
    category: g.category,
    details: g.details || null,
    materials: g.materials || null,
    composition: m.main.length ? compositionText(m.main) : null,
    compositionEstimated: m.main.length ? m.estimated : undefined,
    weightG: g.weightG,
    priceEur: g.price,
    purchased: g.purchased,
    divested: g.divested,
    status: r.active ? "active" : "divested",
    timesWornInRange: r.timesWorn,
    lifetimeWears: r.lifetimeWears,
    costPerWearEur: r2(r.costPerWear),
    wearsPerMonth: r2(r.wearsPerMonth),
  };
}

export type GarmentSort = "times_worn" | "cost_per_wear" | "wears_per_month" | "price" | "purchased" | "name" | "weight";

export function listGarments(
  w: Wardrobe,
  opts: {
    range: DateRange;
    category?: string;
    status?: "active" | "divested" | "all";
    search?: string;
    fibre?: string;
    minWeightG?: number;
    maxWeightG?: number;
    sort?: GarmentSort;
    limit?: number;
  },
) {
  const fibre = opts.fibre?.trim().toLowerCase();
  const q = opts.search?.trim().toLowerCase();
  const rows = itemListing(w.garments, w.days, opts.range)
    .filter((r) => !opts.category || r.garment.category.toLowerCase() === opts.category.toLowerCase())
    .filter((r) => !opts.status || opts.status === "all" || (opts.status === "active") === r.active)
    .filter((r) => !q || `${r.garment.item} ${r.garment.details} ${r.garment.materials}`.toLowerCase().includes(q))
    .filter((r) => !fibre || parseMaterials(r.garment.materials).main.some((c) => c.fibre.includes(fibre)))
    .filter((r) => opts.minWeightG == null || (r.garment.weightG ?? -1) >= opts.minWeightG)
    .filter((r) => opts.maxWeightG == null || (r.garment.weightG != null && r.garment.weightG <= opts.maxWeightG));
  const key: Record<GarmentSort, (r: ItemRow) => number | string> = {
    times_worn: (r) => -r.timesWorn,
    cost_per_wear: (r) => -(r.costPerWear ?? 0),
    wears_per_month: (r) => -r.wearsPerMonth,
    price: (r) => -(r.garment.price ?? 0),
    purchased: (r) => r.garment.purchased ?? "",
    name: (r) => r.garment.item,
    weight: (r) => -(r.garment.weightG ?? -1),
  };
  const k = key[opts.sort ?? "times_worn"];
  rows.sort((a, b) => {
    const [x, y] = [k(a), k(b)];
    return x < y ? -1 : x > y ? 1 : 0;
  });
  const limit = opts.limit ?? 50;
  return { range: opts.range, total: rows.length, shown: Math.min(limit, rows.length), garments: rows.slice(0, limit).map(garmentRow) };
}

export function getGarment(w: Wardrobe, id: string) {
  const g = w.garments.find((x) => x.id === id) ?? w.garments.find((x) => x.item.toLowerCase() === id.toLowerCase());
  if (!g) throw new Error(`No garment with id or name "${id}". Use list_garments to find it.`);
  const range = { from: TRACKING_START, to: lastLoggedDay(w) };
  const [row] = itemListing([g], w.days, range);
  const dates = w.days.filter((d) => d.worn.includes(g.id)).map((d) => d.date);
  const byYear: Record<string, number> = {};
  for (const d of dates) byYear[d.slice(0, 4)] = (byYear[d.slice(0, 4)] ?? 0) + 1;
  return {
    id: g.id,
    name: g.item,
    category: g.category,
    details: g.details,
    materials: g.materials,
    composition: (() => {
      const m = parseMaterials(g.materials);
      return m.main.length ? { mainPart: compositionText(m.main), estimated: m.estimated, parts: m.parts.map((p) => p.label ?? "main") } : null;
    })(),
    weightG: g.weightG,
    priceEur: g.price,
    purchased: g.purchased,
    divested: g.divested,
    status: row ? (row.active ? "active" : "divested") : "not owned within tracking",
    wearsBeforeTracking: g.timesUsedInit,
    lifetimeWears: row?.lifetimeWears ?? g.timesUsedInit,
    costPerWearEur: r2(row?.costPerWear ?? null),
    wearsPerMonth: r2(row?.wearsPerMonth ?? null),
    firstLoggedWear: dates[0] ?? null,
    lastLoggedWear: dates[dates.length - 1] ?? null,
    loggedWearsByYear: byYear,
    recentWears: dates.slice(-20),
    photoUrl: photoUrl(g),
  };
}

export function getWears(w: Wardrobe, range: DateRange) {
  if (dayIndex(range.from, range.to) + 1 > MAX_DAILY_DAYS)
    throw new Error(`Ask for at most ${MAX_DAILY_DAYS} days at a time (use list_garments or get_daily_cost for longer spans).`);
  const byId = new Map(w.garments.map((g) => [g.id, g]));
  return {
    range,
    days: w.days
      .filter((d) => d.date >= range.from && d.date <= range.to)
      .map((d) => ({
        date: d.date,
        items: d.worn.map((id) => ({ id, name: byId.get(id)?.item ?? id, category: byId.get(id)?.category ?? null })),
      })),
  };
}

export function getDailyCost(w: Wardrobe, range: DateRange, category?: string) {
  const garments = category
    ? w.garments.filter((g) => g.category.toLowerCase() === category.toLowerCase())
    : w.garments.filter((g) => g.category !== "Sportswear"); // as on the Dashboard
  const points = dailyCost(garments, w.days, range);
  const mean = points.length ? points.reduce((s, p) => s + p.cost, 0) / points.length : null;
  const summary = {
    range,
    scope: category ?? "all categories except Sportswear (as on the Dashboard)",
    daysWithWears: points.length,
    averageDailyCostEur: r2(mean),
    finalDays: points.filter((p) => p.final).length,
  };
  if (dayIndex(range.from, range.to) + 1 <= MAX_DAILY_DAYS)
    return { ...summary, granularity: "day", days: points.map((p) => ({ date: p.date, costEur: r2(p.cost), final: p.final, average30dEur: r2(p.average) })) };
  const months = new Map<string, { n: number; sum: number; final: number }>();
  for (const p of points) {
    const m = months.get(p.date.slice(0, 7)) ?? { n: 0, sum: 0, final: 0 };
    m.n++;
    m.sum += p.cost;
    if (p.final) m.final++;
    months.set(p.date.slice(0, 7), m);
  }
  return {
    ...summary,
    granularity: "month",
    months: [...months].map(([month, m]) => ({ month, daysWithWears: m.n, averageDailyCostEur: r2(m.sum / m.n), finalDays: m.final })),
  };
}

export function inventoryOverTime(w: Wardrobe, range: DateRange, measure: "items" | "value", category?: string) {
  const garments = category ? w.garments.filter((g) => g.category.toLowerCase() === category.toLowerCase()) : w.garments;
  const series = measure === "items" ? activeItemsOverTime(garments, range) : inventoryValueOverTime(garments, range);
  // One sample per month end (and the range end).
  const dates: string[] = [];
  for (let d = range.from.slice(0, 7); d <= range.to.slice(0, 7); d = addDays(`${d}-28`, 7).slice(0, 7)) {
    const monthEnd = addDays(`${addDays(`${d}-28`, 7).slice(0, 7)}-01`, -1);
    dates.push(monthEnd < range.to ? monthEnd : range.to);
  }
  return {
    range,
    measure: measure === "items" ? "active items" : "inventory value (sum of purchase prices of active items, EUR)",
    samples: dates.map((date) => ({
      date,
      ...Object.fromEntries(series.map((s) => [s.category, r2(valueOn(s.points, date))])),
    })),
  };
}

export function materialTable(w: Wardrobe, range: DateRange, basis: "owned" | "worn", category?: string) {
  const garments = category ? w.garments.filter((g) => g.category.toLowerCase() === category.toLowerCase()) : w.garments;
  const b = materialBreakdown(garments, w.days, range, basis);
  return {
    range,
    scope: category ?? "all categories",
    basis: basis === "owned" ? "garments active at the end of the range" : "every wear in the range counts the garment's full weight",
    totalKg: r2(b.totalKg),
    fibres: b.fibres.map((f) => ({ fibre: f.fibre, kg: r2(f.kg), share: r3(f.share), recycledKg: r2(f.recycledKg), organicKg: r2(f.organicKg) })),
    ...(b.averageOutfitKg != null ? { averageOutfitKg: r2(b.averageOutfitKg) } : {}),
    coverage: {
      ...b.coverage,
      unit: basis === "owned" ? "garments" : "wears",
      note: "Only items with both a weight and readable materials are included; 'estimated' = shares guessed (no percentages given, or not summing to 100).",
    },
  };
}

export const DEFINITIONS = `# Wardrobe Diary: definitions

Data: one person's daily wardrobe log since ${TRACKING_START}; every garment with purchase price and dates.
All metrics accept a date range (from, to); by default from ${TRACKING_START} to the last logged day.

- **Owned / active on a day:** from the purchase date (at the earliest ${TRACKING_START}) to the divest date,
  inclusive. "Divested" = sold, given away or discarded.
- **Times worn (in a range):** logged wears in the range, plus wears before tracking began when the range
  starts on ${TRACKING_START}.
- **Cost per wear (garment):** price ÷ all wears over the garment's whole ownership, regardless of the chosen
  range (an unworn garment costs its full price).
- **Cost per wear (category):** wear-weighted average of its garments' cost per wear, over garments worn at
  least once in the range.
- **Days used (category):** share of days in the range on which any garment of the category was worn.
- **Yearly cost (category):** cost per wear × 365 × days used.
- **Inventory value / turnover:** sum of purchase prices of active garments at the end of the range;
  turnover = yearly cost ÷ inventory value.
- **Wears per month:** times worn ÷ (days owned in the range ÷ 30.5).
- **Daily cost:** sum of the cost per wear of the garments worn that day; "final" when all of them are
  divested (the value can no longer fall). The Dashboard leaves Sportswear out of daily cost.
- **Materials / composition:** read from the free-text Materials field (typos and synonyms normalised:
  lycra = spandex = elastane, nylon = polyamide, tencel = lyocell, rayon = viscose). For garments with
  several parts (shell, lining, padding…) the **main part** counts (shell / main / outer / body / fabric,
  else the first). Percentages are normalised to 100 %; without percentages the fibres share equally and
  the result is marked estimated. Organic and recycled are kept as flags.
- **Fibre mass:** weight × composition. "Owned": garments active at the end of the range. "Worn": every wear
  counts the garment's full weight. Only garments with both a weight and readable materials are included;
  coverage figures say how many.
- **Average outfit weight:** the weight of the garments worn per logged day (garments with a known weight).
- Categories (standard order): ${["Jackets and hoodies", "Blazers and vests", "Knits", "Shirts", "T-shirts and tanks", "Pants", "Shorts", "Belts", "Socks", "Shoes", "Underwear shirts", "Underwear boxers", "Sportswear"].join(", ")}.
- Prices are in euros. Web app: https://wardrobediary.web.app
`;
