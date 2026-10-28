// Rotation series on the Log page: identical garments the owner keeps as one heap and wears in turn, e.g.
// "SOC U 4P Black 01 (39-42)" … "08 (39-42)". Only series the owner has marked (settings/app.rotationSeries)
// are affected: the Log page shows each as one tile that logs the next garment in line, which is the one with
// the fewest lifetime wears, then the lowest number. Pure and tested (rotation.test.ts).
import { lifetimeWears, type WearIndex } from "./metrics";
import type { Garment } from "../types";

export interface SeriesName {
  /** Stored in settings/app.rotationSeries: category and the name without its number. */
  key: string;
  /** The name without its number, e.g. "SOC U 4P Black (39-42)". */
  name: string;
  /** The number as written, e.g. "01". */
  number: string;
}

/** The series a garment would belong to: its name without the trailing number (a size in brackets after the
 *  number is kept, so sizes stay apart). Null for a name without a number. */
export function seriesOf(g: Pick<Garment, "category" | "item">): SeriesName | null {
  const m = g.item.match(/^(.*\S)\s+(\d{1,3})(\s*\(.*\))?\s*$/);
  if (!m) return null;
  const name = `${m[1]}${m[3] ?? ""}`;
  return { key: `${g.category}|${name}`, name, number: m[2] };
}

/** A series' garments in rotation order: fewest lifetime wears first, then the lowest number. */
export function rotationOrder(members: Garment[], wears: WearIndex): Garment[] {
  const n = new Map(members.map((g) => [g.id, lifetimeWears(g, wears)]));
  return [...members].sort((a, b) => n.get(a.id)! - n.get(b.id)! || a.item.localeCompare(b.item, "en", { numeric: true }));
}

/** Each garment of a marked series among `garments` → its place in the rotation (0 = next). Garments outside a
 *  marked series are left out. */
export function rotationRanks(garments: Garment[], marked: ReadonlySet<string>, wears: WearIndex): Map<string, number> {
  const series = new Map<string, Garment[]>();
  for (const g of garments) {
    const key = seriesOf(g)?.key;
    if (key && marked.has(key)) series.set(key, [...(series.get(key) ?? []), g]);
  }
  const ranks = new Map<string, number>();
  for (const members of series.values()) rotationOrder(members, wears).forEach((g, i) => ranks.set(g.id, i));
  return ranks;
}

/** One tile on the Log page: a garment, or a marked series shown as one tile. */
export type LogEntry =
  | { kind: "garment"; garment: Garment }
  | {
      kind: "series";
      key: string;
      name: string;
      members: Garment[];
      /** The member worn on the day being logged (tapping removes it), or null. */
      worn: Garment | null;
      /** The member a tap logs: the first in rotation order among those not worn that day. */
      next: Garment | null;
    };

/**
 * The Log page's tiles. `listed` are the garments the page lists before searching (active or worn that day, within
 * the filters); `matches` is the search. A marked series with two or more listed garments becomes one tile, unless
 * the search matches only some of them (e.g. "Black 05"): then those are listed one by one, so any can be picked.
 */
export function logEntries(
  listed: Garment[],
  matches: (g: Garment) => boolean,
  worn: ReadonlySet<string>,
  marked: ReadonlySet<string>,
  wears: WearIndex,
): LogEntry[] {
  const series = new Map<string, Garment[]>();
  for (const g of listed) {
    const key = seriesOf(g)?.key;
    if (key && marked.has(key)) series.set(key, [...(series.get(key) ?? []), g]);
  }
  const out: LogEntry[] = [];
  const done = new Set<string>();
  for (const g of listed) {
    if (!matches(g)) continue;
    const s = seriesOf(g);
    const members = s && series.get(s.key);
    if (!s || !members || members.length < 2 || !members.every(matches)) {
      out.push({ kind: "garment", garment: g });
      continue;
    }
    if (done.has(s.key)) continue;
    done.add(s.key);
    out.push({
      kind: "series",
      key: s.key,
      name: s.name,
      members,
      worn: members.find((m) => worn.has(m.id)) ?? null,
      next: rotationOrder(members.filter((m) => !worn.has(m.id)), wears)[0] ?? null,
    });
  }
  return out;
}
