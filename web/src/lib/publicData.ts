import type { Day, Garment, IsoDate } from "../types";

/** users/{uid}/public/data: world-readable copy of all garments and the full day log, written by the
 *  Sheet sync (decision D-1). Days hold indexes into `garments`. One document read for public pages. */
export interface PublicData {
  version: 1;
  garments: Garment[];
  days: Record<IsoDate, number[]>;
}

export interface Wardrobe {
  garments: Garment[];
  days: Day[];
}

export function decodePublicData(data: PublicData): Wardrobe {
  return {
    garments: data.garments,
    days: Object.entries(data.days)
      .map(([date, worn]) => ({ date, worn: worn.map((i) => data.garments[i].id) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** The public data without one garment (R-27 phase c). Days hold garment indexes, so every index after
 *  the removed garment shifts down by one; days that only listed the removed garment are dropped. */
export function withoutGarment(data: PublicData, id: string): PublicData {
  const i = data.garments.findIndex((g) => g.id === id);
  if (i < 0) return data;
  const days: Record<IsoDate, number[]> = {};
  for (const [date, worn] of Object.entries(data.days)) {
    const kept = worn.filter((j) => j !== i).map((j) => (j > i ? j - 1 : j));
    if (kept.length > 0) days[date] = kept;
  }
  return { ...data, garments: data.garments.filter((_, j) => j !== i), days };
}

/** The public data with some garments replaced (same positions, so day indexes stay valid). */
export function withGarments(data: PublicData, updated: Garment[]): PublicData {
  const byId = new Map(updated.map((g) => [g.id, g]));
  return { ...data, garments: data.garments.map((g) => byId.get(g.id) ?? g) };
}
