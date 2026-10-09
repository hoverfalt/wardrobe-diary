// Port of the Threddit R metrics (github.com/hoverfalt/Threddit: 01-, 02-, 03-Calculate_plot_data.R).
// Keep these pure and tested.
//
// Metrics take a DateRange (users choose time spans). Wears are counted inside the range only, and
// "Times used init" (wears before tracking began) counts only when the range starts at TRACKING_START.
//
// Exception, by decision D-2 (2026-10-09): a garment's cost per wear never depends on the range. It is
// always price / all wears over the garment's whole ownership (purchase to divest day inclusive, plus
// pre-tracking wears), even wears after the range's end, so the concept is treated consistently.
import type { Day, Garment, IsoDate } from "../types";
import { compareCategories } from "./categories";

export const TRACKING_START: IsoDate = "2018-01-01";
const FOREVER: IsoDate = "9999-12-31";

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

const max = (a: IsoDate, b: IsoDate) => (a > b ? a : b);
const min = (a: IsoDate, b: IsoDate) => (a < b ? a : b);

/** Number of days from a to b inclusive (ISO dates, no timezones). */
export function daysInclusive(a: IsoDate, b: IsoDate): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;
}

/** First day the garment counts as owned within tracking (purchase date, at the earliest TRACKING_START). */
export function ownedFrom(g: Garment): IsoDate {
  return max(g.purchased ?? TRACKING_START, TRACKING_START);
}

/** Last day the garment counts as owned. The divest day itself still counts, as in R. */
export function ownedUntil(g: Garment): IsoDate {
  return g.divested ?? FOREVER;
}

export function isActive(g: Garment, date: IsoDate): boolean {
  return ownedFrom(g) <= date && date <= ownedUntil(g);
}

/** Whether the garment was owned at any point in the range. */
export function ownedDuring(g: Garment, range: DateRange): boolean {
  return ownedFrom(g) <= range.to && ownedUntil(g) >= range.from;
}

/** Sorted wear dates per garment. Build once and pass to the metric functions. */
export type WearIndex = Map<string, IsoDate[]>;

export function wearIndex(days: Day[]): WearIndex {
  const index: WearIndex = new Map();
  for (const day of days) {
    for (const id of day.worn) {
      const list = index.get(id);
      if (list) list.push(day.date);
      else index.set(id, [day.date]);
    }
  }
  for (const list of index.values()) list.sort();
  return index;
}

/** Days the garment was worn within the range, ignoring wears outside its ownership period (as R does). */
export function wearDatesIn(g: Garment, wears: WearIndex, range: DateRange): IsoDate[] {
  const from = max(range.from, ownedFrom(g));
  const to = min(range.to, ownedUntil(g));
  return (wears.get(g.id) ?? []).filter((d) => d >= from && d <= to);
}

/** Times worn in the range, plus pre-tracking wears when the range starts at TRACKING_START. */
export function timesWorn(g: Garment, wears: WearIndex, range: DateRange): number {
  const init = range.from <= TRACKING_START ? g.timesUsedInit : 0;
  return init + wearDatesIn(g, wears, range).length;
}

/** All wears over the garment's whole ownership, including pre-tracking wears. */
export function lifetimeWears(g: Garment, wears: WearIndex): number {
  return timesWorn(g, wears, { from: TRACKING_START, to: FOREVER });
}

/** Price / lifetime wears, independent of any chosen range (D-2). An unworn garment costs its full price (as in R). */
export function costPerWear(g: Garment, wears: WearIndex): number | null {
  if (g.price == null) return null;
  const n = lifetimeWears(g, wears);
  return n === 0 ? g.price : g.price / n;
}

/** Days owned up to range.to (frozen at the divest date). Counts from purchase for pre-tracking items
 *  when the range starts at TRACKING_START, since their pre-tracking wears are included too. */
export function daysOwned(g: Garment, range: DateRange): number {
  const start =
    range.from <= TRACKING_START ? (g.purchased ?? TRACKING_START) : max(range.from, ownedFrom(g));
  const end = min(range.to, ownedUntil(g));
  return Math.max(0, daysInclusive(start, end));
}

export interface ItemRow {
  garment: Garment;
  category: string;
  timesWorn: number;
  costPerWear: number | null;
  wearsPerMonth: number;
  monthsOwned: number;
  active: boolean;
}

/** Per-garment listing (category pages): garments owned at any point in the range. */
export function itemListing(garments: Garment[], days: Day[], range: DateRange): ItemRow[] {
  const wears = wearIndex(days);
  return garments
    .filter((g) => ownedDuring(g, range))
    .map((g) => {
      const n = timesWorn(g, wears, range);
      const owned = daysOwned(g, range);
      return {
        garment: g,
        category: g.category,
        timesWorn: n,
        costPerWear: costPerWear(g, wears),
        wearsPerMonth: owned > 0 ? n / (owned / 30.5) : 0,
        monthsOwned: owned / 30.5,
        active: isActive(g, range.to),
      };
    });
}

export interface CategoryRow {
  category: string;
  /** Garments active on range.to. */
  activeItems: number;
  /** Sum of purchase prices of garments active on range.to. */
  inventoryValue: number;
  /** Use-weighted average of the garments' (lifetime) cost per wear, over garments worn in the range,
   *  weighted by their wears in the range (D-2). */
  costPerWear: number | null;
  /** Share of days in the range on which any garment of the category was worn ("Days used"). */
  daysUsed: number | null;
  /** costPerWear × 365 × daysUsed: what a year of using the category costs at this rate. */
  yearlyCost: number | null;
  /** yearlyCost / inventoryValue: share of the active inventory's value "used up" per year. */
  turnover: number | null;
}

/** The live site's category listing, plus a Total row first. */
export function categoryListing(garments: Garment[], days: Day[], range: DateRange): CategoryRow[] {
  const wears = wearIndex(days);
  const byCategory = new Map<string, Garment[]>();
  for (const g of garments) {
    if (!ownedDuring(g, range)) continue;
    const c = g.category;
    byCategory.set(c, [...(byCategory.get(c) ?? []), g]);
  }

  const rows = [...byCategory.entries()]
    .sort(([a], [b]) => compareCategories(a, b))
    .map(([category, items]): CategoryRow => {
      const active = items.filter((g) => isActive(g, range.to));
      const inventoryValue = sum(active.map((g) => g.price ?? 0));
      let weighted = 0;
      let uses = 0;
      for (const g of items) {
        const n = timesWorn(g, wears, range);
        const cpw = costPerWear(g, wears);
        if (n === 0 || cpw == null) continue;
        weighted += cpw * n;
        uses += n;
      }
      const avgCostPerWear = uses > 0 ? weighted / uses : null;

      // Category days counted from when the category's first garment was owned (as in R).
      const start = max(range.from, items.map(ownedFrom).reduce(min));
      const used = new Set(items.flatMap((g) => wearDatesIn(g, wears, { from: start, to: range.to })));
      const span = daysInclusive(start, range.to);
      const daysUsed = span > 0 ? used.size / span : null;

      const yearlyCost = avgCostPerWear != null && daysUsed != null ? avgCostPerWear * 365 * daysUsed : null;
      return {
        category,
        activeItems: active.length,
        inventoryValue,
        costPerWear: avgCostPerWear,
        daysUsed,
        yearlyCost,
        turnover: yearlyCost != null && inventoryValue > 0 ? yearlyCost / inventoryValue : null,
      };
    });

  const inventoryValue = sum(rows.map((r) => r.inventoryValue));
  const yearlyCost = sum(rows.map((r) => r.yearlyCost ?? 0));
  const total: CategoryRow = {
    category: "Total",
    activeItems: sum(rows.map((r) => r.activeItems)),
    inventoryValue,
    costPerWear: null,
    daysUsed: null,
    yearlyCost,
    turnover: inventoryValue > 0 ? yearlyCost / inventoryValue : null,
  };
  return [total, ...rows];
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export interface SeriesPoint {
  date: IsoDate;
  value: number;
}

export interface CategorySeries {
  category: string;
  /** Change points: the value holds from each date until the next point (step-after); the first point
   *  is range.from and the last is range.to. */
  points: SeriesPoint[];
}

/** Next calendar day. */
export function nextDay(date: IsoDate): IsoDate {
  return new Date(Date.parse(date) + 86_400_000).toISOString().slice(0, 10);
}

/** Sum of `measure` over the garments active on each day of the range, grouped by `group`, as step
 *  series in the standard category order. Groups with no garment owned during the range are left out. */
export function activeOverTime(
  garments: Garment[],
  range: DateRange,
  measure: (g: Garment) => number,
  group: (g: Garment) => string = (g) => g.category,
): CategorySeries[] {
  const deltas = new Map<string, Map<IsoDate, number>>();
  for (const g of garments) {
    if (!ownedDuring(g, range)) continue;
    const key = group(g);
    const byDate = deltas.get(key) ?? new Map<IsoDate, number>();
    deltas.set(key, byDate);
    const m = measure(g);
    const start = max(ownedFrom(g), range.from);
    byDate.set(start, (byDate.get(start) ?? 0) + m);
    if (ownedUntil(g) < range.to) {
      const end = nextDay(ownedUntil(g));
      byDate.set(end, (byDate.get(end) ?? 0) - m);
    }
  }
  return [...deltas.entries()]
    .sort(([a], [b]) => compareCategories(a, b))
    .map(([category, byDate]) => {
      const points: SeriesPoint[] = [{ date: range.from, value: 0 }];
      let value = 0;
      for (const date of [...byDate.keys()].sort()) {
        value = round2(value + byDate.get(date)!); // whole cents: no floating-point drift in sums of prices
        const last = points[points.length - 1];
        if (last.date === date) last.value = value;
        else points.push({ date, value });
      }
      if (points[points.length - 1].date !== range.to) points.push({ date: range.to, value });
      return { category, points };
    });
}

/** "Active items by category": number of active garments per category. */
export function activeItemsOverTime(garments: Garment[], range: DateRange): CategorySeries[] {
  return activeOverTime(garments, range, () => 1);
}

/** "Inventory value by category": sum of purchase prices of active garments per category. */
export function inventoryValueOverTime(garments: Garment[], range: DateRange): CategorySeries[] {
  return activeOverTime(garments, range, (g) => g.price ?? 0);
}

/** "Total inventory value": sum of purchase prices of all active garments. */
export function totalInventoryValueOverTime(garments: Garment[], range: DateRange): SeriesPoint[] {
  return activeOverTime(garments, range, (g) => g.price ?? 0, () => "Total")[0]?.points ?? [];
}

/** The value of a step series on a date. */
export function valueOn(points: SeriesPoint[], date: IsoDate): number {
  let value = 0;
  for (const p of points) {
    if (p.date > date) break;
    value = p.value;
  }
  return value;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
