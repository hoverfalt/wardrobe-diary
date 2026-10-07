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
