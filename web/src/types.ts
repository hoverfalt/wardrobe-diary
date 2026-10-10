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
