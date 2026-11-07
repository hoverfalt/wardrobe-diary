// Port of the Threddit R metrics (github.com/hoverfalt/Threddit: 01-, 02-, 03-Calculate_plot_data.R).
// Keep these pure and tested.
//
// Metrics take a DateRange (users choose time spans). Wears are counted inside the range only, and
// "Times used init" (wears before tracking began) counts only when the range starts at TRACKING_START.
//
// Exception, by decision D-2 (2026-10-09): a garment's cost per wear never depends on the range. It is
// always price / all wears over the garment's whole ownership (purchase to divest day inclusive, plus
// pre-tracking wears), even wears after the range's end, so the concept is treated consistently.
// A category's cost per wear pools the same lifetime figures (D-2 amended 2026-10-16): Σ price / Σ lifetime
// wears over its garments owned in the range, so unworn garments count with their full price.
import type { Day, Garment, IsoDate } from "../types";
import { compareCategories } from "./categories";
import { hasTag } from "./tags";

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
  /** Wears in the range (+ pre-tracking wears when the range starts at TRACKING_START). */
  timesWorn: number;
  /** All wears over the garment's whole ownership, as known on `asOf` (default: all logged wears). */
  lifetimeWears: number;
  /** Price / lifetimeWears (D-2); the full price if unworn. */
  costPerWear: number | null;
  wearsPerMonth: number;
  monthsOwned: number;
  active: boolean;
}

/** Per-garment listing (category pages): garments owned at any point in the range.
 *
 *  With `asOf`, everything is as it was known on that date (for the animations): the range ends at
 *  `asOf` at the latest, cost per wear counts only wears up to then, and "active" means not yet divested. */
export function itemListing(garments: Garment[], days: Day[], range: DateRange, asOf: IsoDate = FOREVER): ItemRow[] {
  const wears = wearIndex(days);
  const r: DateRange = { from: range.from, to: min(range.to, asOf) };
  const known: DateRange = { from: TRACKING_START, to: asOf };
  return garments
    .filter((g) => ownedDuring(g, r))
    .map((g) => {
      const n = timesWorn(g, wears, r);
      const lifetime = timesWorn(g, wears, known);
      const owned = daysOwned(g, r);
      return {
        garment: g,
        category: g.category,
        timesWorn: n,
        lifetimeWears: lifetime,
        costPerWear: g.price == null ? null : lifetime === 0 ? g.price : g.price / lifetime,
        wearsPerMonth: owned > 0 ? n / (owned / 30.5) : 0,
        monthsOwned: owned / 30.5,
        active: isActive(g, r.to),
      };
    });
}

/** Averages over divested garments owned ≥ 30 days (R: avg_*_divested): wears per month (Σ wears /
 *  Σ days owned × 30.5) and use-weighted cost per wear (Σ cost per wear × wears / Σ wears). */
export function divestedAverages(rows: ItemRow[]): { wearsPerMonth: number; costPerWear: number } | null {
  const divested = rows.filter((r) => !r.active && r.monthsOwned * 30.5 >= 30 && r.costPerWear != null);
  const wears = divested.reduce((s, r) => s + r.timesWorn, 0);
  const days = divested.reduce((s, r) => s + r.monthsOwned * 30.5, 0);
  if (divested.length === 0 || wears === 0 || days === 0) return null;
  return {
    wearsPerMonth: (wears / days) * 30.5,
    costPerWear: divested.reduce((s, r) => s + r.costPerWear! * r.timesWorn, 0) / wears,
  };
}

export interface CategoryRow {
  category: string;
  /** Garments active on range.to. */
  activeItems: number;
  /** Sum of purchase prices of garments active on range.to. */
  inventoryValue: number;
  /** Σ price / Σ lifetime wears over the category's garments owned at any point in the range, unworn ones
   *  included (their price counts, with no wears); divided by 1 when none has ever been worn (D-2, amended
   *  2026-10-16). Garments without a price are left out. */
  costPerWear: number | null;
  /** Share of days in the range on which any garment of the category was worn ("Days used"). */
  daysUsed: number | null;
  /** costPerWear × 365 × daysUsed: what a year of using the category costs at this rate. */
  yearlyCost: number | null;
  /** yearlyCost / inventoryValue: share of the active inventory's value "used up" per year. */
  turnover: number | null;
  /** Share of the garments active on range.to that were bought second hand (null when none are active). */
  secondHandShare: number | null;
}

/** The live site's category listing, plus a Total row first.
 *
 *  With `asOf`, everything is as it was known on that date (for the trails): the range ends at `asOf` at the
 *  latest and cost per wear counts only wears up to then. */
export function categoryListing(garments: Garment[], days: Day[], range: DateRange, asOf: IsoDate = FOREVER): CategoryRow[] {
  return listCategories(garments, wearIndex(days), { from: range.from, to: min(range.to, asOf) }, asOf);
}

function listCategories(garments: Garment[], wears: WearIndex, range: DateRange, asOf: IsoDate): CategoryRow[] {
  const known: DateRange = { from: TRACKING_START, to: asOf };
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
      // Pooled lifetime cost per wear (D-2 amended): what the garments cost over all the use they get.
      const priced = items.filter((g) => g.price != null);
      const prices = sum(priced.map((g) => g.price!));
      const lifetime = sum(priced.map((g) => timesWorn(g, wears, known)));
      const avgCostPerWear = priced.length > 0 ? prices / Math.max(1, lifetime) : null;

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
        secondHandShare: active.length ? active.filter((g) => hasTag(g, "second-hand")).length / active.length : null,
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
    secondHandShare: (() => {
      const active = garments.filter((g) => ownedDuring(g, range) && isActive(g, range.to));
      return active.length ? active.filter((g) => hasTag(g, "second-hand")).length / active.length : null;
    })(),
  };
  return [total, ...rows];
}

export interface TrailPoint {
  date: IsoDate;
  costPerWear: number;
  daysUsed: number;
  yearlyCost: number;
}

/** How each category's listing values developed over the range: one point per day before range.to, each as known
 *  on that day (only wears logged by then count) and averaged over 30 days (days i−14 … i+15, fewer at the ends)
 *  to damp seasonal swings, and a last point equal to the listing itself (D-2), not averaged. A category's first
 *  30 days are left out: with so few days, its days used swings between 0 and 100 %. For the Dashboard's trails;
 *  categories in the standard order. */
export function categoryTrails(garments: Garment[], days: Day[], range: DateRange): Map<string, TrailPoint[]> {
  const wears = wearIndex(days);
  const trails = new Map<string, TrailPoint[]>();
  for (const [category, points] of dailyCategoryListing(garments, wears, range)) trails.set(category, rollingTrail(points.slice(30), 30));
  for (const r of listCategories(garments, wears, range, FOREVER)) {
    if (r.category === "Total" || r.costPerWear == null || r.daysUsed == null || r.yearlyCost == null) continue;
    const point = { date: range.to, costPerWear: r.costPerWear, daysUsed: r.daysUsed, yearlyCost: r.yearlyCost };
    trails.set(r.category, [...(trails.get(r.category) ?? []), point]);
  }
  return new Map([...trails].sort(([a], [b]) => compareCategories(a, b)));
}

/**
 * The category listing's cost per wear, days used and yearly cost for every day t before range.to, for the range
 * (range.from .. t) as known on t: the same values as `categoryListing(garments, days, { from, to: t }, t)`, in one
 * pass over the days instead of one listing per day (metrics.test.ts checks they agree).
 */
export function dailyCategoryListing(garments: Garment[], wears: WearIndex, range: DateRange): Map<string, TrailPoint[]> {
  interface Category {
    /** First day of the category's span: its first garment's entry. */
    start: IsoDate;
    prices: number;
    priced: number;
    /** Lifetime wears of its priced garments as known on the day. */
    lifetime: number;
    used: number;
    points: TrailPoint[];
  }
  // A garment joins its category on the later of the range start and its first day owned; from then on its price,
  // its pre-tracking wears and the wears logged so far count, and each later wear counts from its own day.
  const joins = new Map<IsoDate, Garment[]>();
  const wearAdds = new Map<IsoDate, Garment[]>();
  for (const g of garments) {
    if (ownedUntil(g) < range.from) continue;
    const join = max(range.from, ownedFrom(g));
    if (join >= range.to) continue;
    joins.set(join, [...(joins.get(join) ?? []), g]);
    if (g.price == null) continue;
    for (const d of wearDatesIn(g, wears, { from: nextDay(join), to: range.to })) wearAdds.set(d, [...(wearAdds.get(d) ?? []), g]);
  }
  // Days on which each category was worn (wears within the garment's ownership).
  const usedOn = new Map<IsoDate, Set<string>>();
  for (const g of garments) {
    for (const d of wearDatesIn(g, wears, { from: range.from, to: range.to })) {
      if (d >= range.to) continue;
      usedOn.set(d, (usedOn.get(d) ?? new Set()).add(g.category));
    }
  }
  const categories = new Map<string, Category>();
  for (let t = range.from; t < range.to; t = nextDay(t)) {
    for (const g of joins.get(t) ?? []) {
      const c = categories.get(g.category) ?? { start: t, prices: 0, priced: 0, lifetime: 0, used: 0, points: [] };
      categories.set(g.category, c);
      if (g.price == null) continue;
      c.prices += g.price;
      c.priced++;
      c.lifetime += timesWorn(g, wears, { from: TRACKING_START, to: t });
    }
    for (const g of wearAdds.get(t) ?? []) categories.get(g.category)!.lifetime++;
    for (const category of usedOn.get(t) ?? []) categories.get(category)!.used++;
    for (const c of categories.values()) {
      if (c.priced === 0) continue;
      const costPerWear = c.prices / Math.max(1, c.lifetime);
      const daysUsed = c.used / daysInclusive(c.start, t);
      c.points.push({ date: t, costPerWear, daysUsed, yearlyCost: costPerWear * 365 * daysUsed });
    }
  }
  return new Map([...categories].map(([category, c]) => [category, c.points]));
}

/** Each point's values averaged over a window of `size` points centred on it (i−14 … i+15 for 30), fewer at the ends. */
function rollingTrail(points: TrailPoint[], size: number): TrailPoint[] {
  const back = Math.floor((size - 1) / 2);
  const sums = { c: [0], d: [0], y: [0] };
  for (const p of points) {
    sums.c.push(sums.c[sums.c.length - 1] + p.costPerWear);
    sums.d.push(sums.d[sums.d.length - 1] + p.daysUsed);
    sums.y.push(sums.y[sums.y.length - 1] + p.yearlyCost);
  }
  return points.map((p, i) => {
    const lo = Math.max(0, i - back);
    const hi = Math.min(points.length, i + size - back);
    const mean = (s: number[]) => (s[hi] - s[lo]) / (hi - lo);
    return { date: p.date, costPerWear: mean(sums.c), daysUsed: mean(sums.d), yearlyCost: mean(sums.y) };
  });
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

export interface DailyCostPoint {
  date: IsoDate;
  /** Sum of the cost per wear of the garments worn that day (R: `calculate_daily_cost`). */
  cost: number;
  /** All garments worn that day are divested, so their cost per wear, and the day's cost, are final. */
  final: boolean;
  /** 30-day rolling average centred on the day; null near the ends of the range. */
  average: number | null;
}

/** Daily cost for each day in the range on which something was worn.
 *
 *  By default (D-2) each garment's cost per wear is its lifetime value. With `asOf`, everything is
 *  computed as it was known on that date: only wears up to `asOf` count, and a garment is "divested"
 *  only if it was divested by then. That is what the live site's daily cost animation shows. */
export function dailyCost(garments: Garment[], days: Day[], range: DateRange, asOf: IsoDate = FOREVER): DailyCostPoint[] {
  const wears = wearIndex(days);
  const known: DateRange = { from: TRACKING_START, to: asOf };
  const byId = new Map(garments.map((g) => [g.id, g]));
  const cpw = new Map<string, number>();
  const costOf = (g: Garment) => {
    let c = cpw.get(g.id);
    if (c === undefined) {
      const n = timesWorn(g, wears, known);
      c = g.price == null ? 0 : n === 0 ? g.price : g.price / n;
      cpw.set(g.id, c);
    }
    return c;
  };
  const to = min(range.to, asOf);
  const points: DailyCostPoint[] = [];
  for (const day of days) {
    if (day.date < range.from || day.date > to) continue;
    let cost = 0;
    let final = true;
    let worn = 0;
    for (const id of day.worn) {
      const g = byId.get(id);
      if (!g || !isActive(g, day.date)) continue; // wears outside ownership don't count (as in R)
      cost += costOf(g);
      final &&= g.divested != null && g.divested <= asOf;
      worn++;
    }
    if (worn > 0) points.push({ date: day.date, cost, final, average: null });
  }
  const averages = rollingMean(points.map((p) => p.cost), 30);
  points.forEach((p, i) => (p.average = averages[i]));
  return points;
}

/** Mean of `window` consecutive values centred on each index (R: roll_mean shifted to the midpoint:
 *  values i−14 … i+15 for a 30-value window); null where the window doesn't fit. */
export function rollingMean(values: number[], window: number): (number | null)[] {
  const ahead = Math.round(window / 2); // the window ending at i is centred on i − ahead
  const out: (number | null)[] = values.map(() => null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out[i - ahead] = sum / window;
  }
  return out;
}

/** The p-quantile of values with linear interpolation (R's default, type 7); null for no values. */
export function quantile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  return sorted[lo] + (h - lo) * ((sorted[lo + 1] ?? sorted[lo]) - sorted[lo]);
}
