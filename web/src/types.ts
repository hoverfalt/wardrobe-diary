/** ISO date string, YYYY-MM-DD. */
export type IsoDate = string;

export interface Garment {
  id: string;
  category: string;
  item: string;
  details: string;
  photo: string;
  /** Changes whenever the photo is replaced; part of the photo URL so browsers don't show a cached old one. */
  photoVersion?: string | null;
  /** Owner's mark on a divested garment: its missing details (materials, weight) can't be filled in any more,
   *  so it is left out of the review list. */
  detailsUnavailable?: boolean;
  /** Descriptive tags from the fixed vocabulary in lib/tags.ts, e.g. "second-hand". */
  tags?: string[];
  price: number | null;
  purchased: IsoDate | null;
  divested: IsoDate | null;
  timesUsedInit: number;
  materials: string;
  weightG: number | null;
}

/** users/{uid}/days/{date} */
export interface Day {
  date: IsoDate;
  worn: string[];
}
