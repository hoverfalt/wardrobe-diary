// Logging wears in the app (R-13/R-15: the app is the source of truth for wears since 2026-10-09).
import { addDays, dayIndex } from "./dates";
import type { Day, Garment, IsoDate } from "../types";

/** A day's worn garments after toggling one, as garment ids (for days/{date}) and as indexes into the
 *  public data's garment list (for public/data days.{date}). */
export function toggleWorn(
  garments: Garment[],
  wornIds: string[],
  garmentId: string,
  on: boolean,
): { ids: string[]; indexes: number[] } {
  const ids = on ? (wornIds.includes(garmentId) ? wornIds : [...wornIds, garmentId]) : wornIds.filter((id) => id !== garmentId);
  const index = new Map(garments.map((g, i) => [g.id, i]));
  const indexes = ids.map((id) => index.get(id)).filter((i): i is number => i !== undefined);
  return { ids, indexes };
}

/** Wears per garment in the `window` days before `date` (for putting often-worn garments first). */
export function recentWears(days: Day[], date: IsoDate, window = 60): Map<string, number> {
  const from = addDays(date, -window);
  const counts = new Map<string, number>();
  for (const d of days) {
    if (d.date < from || d.date >= date) continue;
    for (const id of d.worn) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** "ma 9.10.2026" style label, with "today" / "yesterday". */
export function dayLabel(date: IsoDate, today: IsoDate): string {
  const diff = dayIndex(date, today);
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const base = `${weekday} ${d}.${m}.${y}`;
  return diff === 0 ? `Today, ${base}` : diff === 1 ? `Yesterday, ${base}` : base;
}
