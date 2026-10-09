import type { IsoDate } from "../types";

export function todayIso(): IsoDate {
  const d = new Date();
  return toIso(d);
}

export function toIso(d: Date): IsoDate {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Finnish display format used in the original Sheet: 7.10.2026 */
export function formatFi(iso: IsoDate | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}.${m}.${y}`;
}

/** Whether from…to is a usable range within [earliest, latest]. Guards against half-typed dates:
 *  while a year is typed digit by digit, date inputs report years like 0002, 0020 and 0202. */
export function isValidRange(range: { from: IsoDate; to: IsoDate }, earliest: IsoDate, latest: IsoDate): boolean {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  return (
    iso.test(range.from) && iso.test(range.to) &&
    range.from >= earliest && range.to <= latest && range.from <= range.to
  );
}
