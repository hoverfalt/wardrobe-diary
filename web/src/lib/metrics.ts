// Port of the Threddit R metrics. Keep these pure and tested.
// Definitions marked TODO must be confirmed against the R scripts (02-, 03-).
import type { Day, Garment, IsoDate } from "../types";

export function wearCounts(days: Day[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const day of days) {
    for (const id of day.worn) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function timesUsed(g: Garment, counts: Map<string, number>): number {
  return g.timesUsedInit + (counts.get(g.id) ?? 0);
}

/** Price / times used. TODO: confirm how R handles 0 uses (here: null). */
export function costPerWear(g: Garment, counts: Map<string, number>): number | null {
  const n = timesUsed(g, counts);
  if (g.price == null || n === 0) return null;
  return g.price / n;
}

export function isActive(g: Garment, date: IsoDate): boolean {
  if (!g.purchased || g.purchased > date) return false;
  return !g.divested || date < g.divested;
}

export interface CategorySummary {
  category: string;
  activeItems: number;
  inventoryValue: number;
  avgCostPerWear: number | null;
  /** Share of logged days on which at least one item of the category was worn. */
  frequency: number;
}

export function categorySummary(garments: Garment[], days: Day[], date: IsoDate): CategorySummary[] {
  const counts = wearCounts(days);
  const categoryOf = new Map(garments.map((g) => [g.id, g.category]));
  const daysWithCategory = new Map<string, number>();
  for (const day of days) {
    const cats = new Set(day.worn.map((id) => categoryOf.get(id)).filter(Boolean) as string[]);
    for (const c of cats) daysWithCategory.set(c, (daysWithCategory.get(c) ?? 0) + 1);
  }

  const byCategory = new Map<string, Garment[]>();
  for (const g of garments) {
    const list = byCategory.get(g.category) ?? [];
    list.push(g);
    byCategory.set(g.category, list);
  }

  return [...byCategory.entries()].map(([category, items]) => {
    const active = items.filter((g) => isActive(g, date));
    const cpws = active.map((g) => costPerWear(g, counts)).filter((v): v is number => v != null);
    return {
      category,
      activeItems: active.length,
      inventoryValue: active.reduce((sum, g) => sum + (g.price ?? 0), 0),
      avgCostPerWear: cpws.length ? cpws.reduce((a, b) => a + b, 0) / cpws.length : null,
      frequency: days.length ? (daysWithCategory.get(category) ?? 0) / days.length : 0,
    };
  });
}
