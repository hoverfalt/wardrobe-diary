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
