/** ISO date string, YYYY-MM-DD. */
export type IsoDate = string;

export interface Garment {
  id: string;
  category: string;
  item: string;
  details: string;
  photo: string;
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
