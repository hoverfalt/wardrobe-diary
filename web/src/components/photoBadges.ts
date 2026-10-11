// Tag badges drawn on item photos in charts: a small rounded label ("SH") on the photo's top-right edge.
import * as Plot from "@observablehq/plot";
import { TAGS, tagsOf } from "../lib/tags";
import type { Garment } from "../types";

export function photoBadgeMarks<T extends { garment: Garment }>(data: T[], x: string, y: string, r: number): Plot.Markish[] {
  const tagged = data.flatMap((d) => tagsOf(d.garment).slice(0, 1).map((t) => ({ ...d, badge: TAGS[t].badge })));
  if (tagged.length === 0) return [];
  const offset = { dx: r * 0.8, dy: -r * 0.8 };
  return [
    Plot.dot(tagged, { x, y, r: Math.max(6, r * 0.42), fill: "var(--tag-bg)", stroke: "var(--bg)", strokeWidth: 1, ...offset }),
    Plot.text(tagged, { x, y, text: "badge", fill: "var(--tag-fg)", fontSize: Math.max(7, r * 0.42), fontWeight: 700, ...offset }),
  ];
}

/** "Second hand" etc. for tooltips. */
export function tagLines(g: Garment): string {
  return tagsOf(g).map((t) => `\n${TAGS[t].label}`).join("");
}
