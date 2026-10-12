// Tag badges drawn on item photos in charts: a small rounded label ("SH", "HKO", "BIKE", "MC") on the photo's top-right edge.
import * as Plot from "@observablehq/plot";
import { TAGS, tagsOf } from "../lib/tags";
import type { Garment } from "../types";

export function photoBadgeMarks<T extends { garment: Garment }>(data: T[], x: string, y: string, r: number): Plot.Markish[] {
  const tagged = data.flatMap((d) => tagsOf(d.garment).slice(0, 1).map((t) => ({ ...d, badge: TAGS[t].badge })));
  if (tagged.length === 0) return [];
  const offset = { dx: r * 0.8, dy: -r * 0.8 };
  const fontSize = Math.max(7, r * 0.4);
  return [
    // The badge background is a thick rounded stroke around the text, so it fits "SH" and "BIKE" alike.
    Plot.text(tagged, { x, y, text: "badge", fill: "var(--tag-bg)", stroke: "var(--tag-bg)", strokeWidth: fontSize * 1.1, strokeLinejoin: "round", fontSize, fontWeight: 700, ...offset }),
    Plot.text(tagged, { x, y, text: "badge", fill: "var(--tag-fg)", fontSize, fontWeight: 700, ...offset }),
  ];
}

/** "Second hand" etc. for tooltips. */
export function tagLines(g: Garment): string {
  return tagsOf(g).map((t) => `\n${TAGS[t].label}`).join("");
}
