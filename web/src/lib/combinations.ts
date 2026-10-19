// Worn together (R-45): which garments are worn on the same day as which. Pure and tested, like metrics.ts.
// A day counts for a garment only while it is owned (purchase to divest day inclusive), as in the other metrics.
import type { Day, Garment, IsoDate } from "../types";
import { isActive, type DateRange } from "./metrics";

export interface WornTogether {
  /** Days each garment was worn in the range (garments without wears are left out). */
  wears: Map<string, number>;
  /** Symmetric: pairs.get(a).get(b) = days a and b were worn together in the range. */
  pairs: Map<string, Map<string, number>>;
}

/** The logged days in the range, each with only the garments owned that day. */
function ownedWears(garments: Garment[], days: Day[], range: DateRange): { date: IsoDate; worn: string[] }[] {
  const byId = new Map(garments.map((g) => [g.id, g]));
  return days
    .filter((d) => d.date >= range.from && d.date <= range.to)
    .map((d) => ({ date: d.date, worn: [...new Set(d.worn)].filter((id) => { const g = byId.get(id); return g != null && isActive(g, d.date); }) }));
}

export function wornTogether(garments: Garment[], days: Day[], range: DateRange): WornTogether {
  const wears = new Map<string, number>();
  const pairs = new Map<string, Map<string, number>>();
  const add = (a: string, b: string) => {
    let m = pairs.get(a);
    if (!m) pairs.set(a, (m = new Map()));
    m.set(b, (m.get(b) ?? 0) + 1);
  };
  for (const { worn } of ownedWears(garments, days, range)) {
    for (const id of worn) wears.set(id, (wears.get(id) ?? 0) + 1);
    for (let i = 0; i < worn.length; i++)
      for (let j = i + 1; j < worn.length; j++) {
        add(worn[i], worn[j]);
        add(worn[j], worn[i]);
      }
  }
  return { wears, pairs };
}

export interface Companion {
  id: string;
  /** Days worn together with the subject. */
  days: number;
  /** days / the companion's own days worn in the range. */
  shareOfItsWears: number;
}

/**
 * The garments most often worn together with a subject: one garment, or a set (a category), counting each day
 * once even when two of the subject's garments were worn that day. The subject's own garments are left out.
 * Ties: more own wears first, then id.
 */
export function companions(subject: Set<string>, garments: Garment[], days: Day[], range: DateRange, limit = Infinity): { subjectDays: number; companions: Companion[] } {
  const together = new Map<string, number>();
  const own = new Map<string, number>();
  let subjectDays = 0;
  for (const { worn } of ownedWears(garments, days, range)) {
    for (const id of worn) own.set(id, (own.get(id) ?? 0) + 1);
    if (!worn.some((id) => subject.has(id))) continue;
    subjectDays++;
    for (const id of worn) if (!subject.has(id)) together.set(id, (together.get(id) ?? 0) + 1);
  }
  const list = [...together].map(([id, n]): Companion => ({ id, days: n, shareOfItsWears: n / own.get(id)! }));
  list.sort((a, b) => b.days - a.days || own.get(b.id)! - own.get(a.id)! || a.id.localeCompare(b.id));
  return { subjectDays, companions: list.slice(0, limit) };
}
