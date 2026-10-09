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
