// Comparison to other spending (R-26): monthly costs and use frequencies of other consumption (transport,
// subscriptions, tools…), entered by the owner and drawn next to the wardrobe categories on the Dashboard.
// Imported once from the Sheet's "Comparison" tab (values only, not its formulas); edited at /manage/comparison.

/** One item, as stored in users/{uid}/settings/comparison (`items`) and in public/data (`comparison`). */
export interface ComparisonItem {
  id: string;
  /** e.g. "Content", "Physical service" */
  type: string;
  item: string;
  details: string;
  /** Storage file name without .png, e.g. "Comparison-HSL"; "" when no photo has been uploaded. */
  photo: string;
  photoVersion?: string | null;
  /** € per month (entered) */
  monthlyCost: number;
  /** Share of days it is used, 0…1 (entered) */
  useFrequency: number;
}

/** Days per month, as in R and the Sheet (`Monthly cost / (30,5 × Use frequency)`). */
export const DAYS_PER_MONTH = 30.5;

export const yearlyCost = (c: Pick<ComparisonItem, "monthlyCost">): number => c.monthlyCost * 12;

/** € per day of use; null when it is never used. */
export const costPerUse = (c: Pick<ComparisonItem, "monthlyCost" | "useFrequency">): number | null =>
  c.useFrequency > 0 ? c.monthlyCost / (DAYS_PER_MONTH * c.useFrequency) : null;

/** Reads a number typed the Finnish or English way ("59,70", "59.7", "1 047,5"); null if not a number. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/[\s €]/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Reads a use frequency: a percentage ("85,7" or "85,7 %") or a fraction of days ("6/7", "22/365").
 *  Returns a share 0…1, or null if it can't be read or is outside 0–100 %. */
export function parseFrequency(text: string): number | null {
  const t = text.trim().replace(/%$/, "").trim();
  const fraction = t.match(/^(.+)\/(.+)$/);
  let share: number | null;
  if (fraction) {
    const [a, b] = [parseNumber(fraction[1]), parseNumber(fraction[2])];
    share = a != null && b ? a / b : null;
  } else {
    const p = parseNumber(t);
    share = p == null ? null : p / 100;
  }
  return share != null && share >= 0 && share <= 1 ? share : null;
}

/** A frequency for an input box: percent with up to one decimal, Finnish decimal comma. */
export const formatFrequency = (share: number): string =>
  (Math.round(share * 1000) / 10).toLocaleString("fi-FI", { maximumFractionDigits: 1 });

/** Id for a new item from its name: lower-case letters, digits and dashes, unique among `taken`. */
export function comparisonId(item: string, taken: Iterable<string>): string {
  const base = item.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  const used = new Set(taken);
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
  return id;
}

/** Storage file name for a new item's photo, following the live site's "Comparison-<Name>" pattern. */
export const comparisonPhotoName = (item: string): string =>
  `Comparison-${item.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") || "Item"}`;

/** Types in first-seen order, for grouping and the type suggestions. */
export const comparisonTypes = (items: ComparisonItem[]): string[] => [...new Set(items.map((c) => c.type).filter(Boolean))];
