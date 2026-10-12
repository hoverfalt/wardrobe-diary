// Garment tags: a small fixed vocabulary (user-defined tags are a later, multi-user idea; ROADMAP).
// Tags only describe garments; they never change any calculation (prices are what was paid, wears count
// from the purchase date).
import type { Garment } from "../types";

export interface TagDef {
  label: string;
  /** Short text for the badge on photos and next to names. */
  badge: string;
  description: string;
}

export const TAGS = {
  "second-hand": {
    label: "Second hand",
    badge: "SH",
    description: "Bought second hand: used before; the price is what was paid, and wears count from the purchase.",
  },
  // Kept at the summer home in Hanko (blue rows in the Sheet; "(Hanko)" in the name). See ROADMAP R-33.
  hanko: {
    label: "Hanko",
    badge: "HKO",
    description: "Kept at the summer home in Hanko, so only worn there.",
  },
  bicycle: {
    label: "Bicycle gear",
    badge: "BIKE",
    description: "Cycling gear.",
  },
  motorcycle: {
    label: "Motorcycle gear",
    badge: "MC",
    description: "Motorcycle gear.",
  },
} satisfies Record<string, TagDef>;

export type Tag = keyof typeof TAGS;
export const TAG_IDS = Object.keys(TAGS) as Tag[];
/** Tags drawn as badges on chart photos and in chart legends; the others would clutter the charts (they still
 *  show next to names, in tooltips, filters and search). */
export const CHART_TAGS: Tag[] = ["second-hand"];

export function hasTag(g: Pick<Garment, "tags">, tag: Tag): boolean {
  return g.tags?.includes(tag) ?? false;
}

/** The garment's known tags, in vocabulary order. */
export function tagsOf(g: Pick<Garment, "tags">): Tag[] {
  return TAG_IDS.filter((t) => g.tags?.includes(t));
}

/** Text a search box matches against a garment's tags: labels and badges, e.g. "motorcycle gear mc". */
export function tagSearchText(g: Pick<Garment, "tags">): string {
  return tagsOf(g).map((t) => `${TAGS[t].label} ${TAGS[t].badge}`).join(" ").toLowerCase();
}

/** Markers typed in a name that become tags on save: "(SH)" → second hand, "(Hanko)" → Hanko. */
const NAME_MARKERS: [RegExp, Tag][] = [
  [/\s*\(SH\)/gi, "second-hand"],
  [/\s*\(Hanko\)/gi, "hanko"],
];

/** The name without its tag markers, and the tags they stand for. */
export function tagsFromName(item: string): { item: string; tags: Tag[] } {
  let name = item;
  const tags: Tag[] = [];
  for (const [re, tag] of NAME_MARKERS) {
    const next = name.replace(re, "");
    if (next !== name) tags.push(tag);
    name = next;
  }
  return { item: name.trim(), tags };
}

/** "(SH)" in an item name → the second-hand tag (the one-time migration and the add form use this). */
export function secondHandFromName(item: string): { item: string; secondHand: boolean } {
  const m = item.match(/^(.*?)\s*\(SH\)\s*$/);
  return m ? { item: m[1], secondHand: true } : { item, secondHand: false };
}
