/** The standard category order. Use it wherever categories are listed. */
export const CATEGORY_ORDER = [
  "Jackets and hoodies",
  "Blazers and vests",
  "Knits",
  "Shirts",
  "T-shirts and tanks",
  "Pants",
  "Shorts",
  "Belts",
  "Socks",
  "Shoes",
  "Underwear shirts",
  "Underwear boxers",
  "Sportswear",
];

/** Sort comparator for category names; categories not in CATEGORY_ORDER sort last, alphabetically. */
export function compareCategories(a: string, b: string): number {
  const ia = CATEGORY_ORDER.indexOf(a);
  const ib = CATEGORY_ORDER.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0 || ib >= 0) return ia >= 0 ? -1 : 1;
  return a.localeCompare(b);
}

/** Category colours of the live site's charts (R `category_colors`), in CATEGORY_ORDER. */
const CATEGORY_COLORS_LIGHT = [
  "#960001", "#FC3334", "#FF9A02", "#FFDB05", "#4CDA00", "#00B0F0",
  "#0070C0", "#002060", "#A860E9", "#7030A0", "#A5A5A5", "#7B7B7B", "#444444",
];
// On a dark background the darkest ones get lighter steps of the same hue.
const DARK_OVERRIDES: Record<string, string> = {
  "#960001": "#D0403F",
  "#002060": "#4A78D0",
  "#7030A0": "#9B5FD0",
  "#444444": "#8A8A8A",
};

export function categoryColor(category: string, dark = false): string {
  const light = CATEGORY_COLORS_LIGHT[CATEGORY_ORDER.indexOf(category)] ?? "#888888";
  return dark ? (DARK_OVERRIDES[light] ?? light) : light;
}
