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
} satisfies Record<string, TagDef>;

export type Tag = keyof typeof TAGS;
export const TAG_IDS = Object.keys(TAGS) as Tag[];

export function hasTag(g: Pick<Garment, "tags">, tag: Tag): boolean {
  return g.tags?.includes(tag) ?? false;
}

/** The garment's known tags, in vocabulary order. */
export function tagsOf(g: Pick<Garment, "tags">): Tag[] {
  return TAG_IDS.filter((t) => g.tags?.includes(t));
}

/** "(SH)" in an item name → the second-hand tag (the one-time migration and the add form use this). */
export function secondHandFromName(item: string): { item: string; secondHand: boolean } {
  const m = item.match(/^(.*?)\s*\(SH\)\s*$/);
  return m ? { item: m[1], secondHand: true } : { item, secondHand: false };
}
