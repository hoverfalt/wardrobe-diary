// Data quality rules (ROADMAP R-40 phase 3): one check per rule in semantics/catalog.yaml (quality_rules),
// run on the public data document. Shared by the /data page (in the browser), the nightly quality check
// (web/scripts/quality-check.mjs) and tests, so the published results and the checks are the same code.
// semantics.test.ts fails if a catalogued rule has no check here.
import { CATEGORY_ORDER } from "./categories";
import { materialsIssue } from "./materials";
import { ownedFrom, ownedUntil, TRACKING_START } from "./metrics";
import type { PublicData } from "./publicData";
import { TAG_IDS } from "./tags";

export type QualityStatus = "pass" | "warn" | "fail" | "info" | "not-checked";

export interface QualityResult {
  id: string;
  status: QualityStatus;
  /** Records breaking the rule (or, for "info" rules, the measured value's numerator). */
  count: number;
  /** Records checked. */
  total: number;
  summary: string;
  /** A few offending records, for follow-up. */
  examples: string[];
}

type Check = (data: PublicData, asOf: string) => Omit<QualityResult, "id">;

const fmt = (n: number) => n.toLocaleString("en-GB");
/** `ok` describes the passing records ("garment ids are unique"), `problem` the failing ones ("duplicate ids"). */
const result = (bad: string[], total: number, ok: string, problem: string, severity: "fail" | "warn" = "fail"): Omit<QualityResult, "id"> => ({
  status: bad.length === 0 ? "pass" : severity,
  count: bad.length,
  total,
  summary: bad.length === 0 ? `${fmt(total)} checked: ${ok}` : `${fmt(bad.length)} of ${fmt(total)}: ${problem}`,
  examples: bad.slice(0, 5),
});

export const CHECKS: Record<string, Check> = {
  "unique-ids": ({ garments }) => {
    const seen = new Set<string>();
    const dup = garments.filter((g) => (seen.has(g.id) ? true : (seen.add(g.id), false))).map((g) => g.id);
    return result(dup, garments.length, "all ids unique", "duplicate ids");
  },
  "known-category": ({ garments }) =>
    result(garments.filter((g) => !CATEGORY_ORDER.includes(g.category)).map((g) => `${g.id}: ${g.category}`), garments.length, "all categories known", "unknown category"),
  "dates-ordered": ({ garments }) =>
    result(garments.filter((g) => g.purchased && g.divested && g.purchased > g.divested).map((g) => `${g.id}: ${g.purchased} > ${g.divested}`), garments.length, "all dates in order", "divested before purchased"),
  "non-negative": ({ garments }) =>
    result(
      garments
        .filter((g) => (g.price != null && g.price < 0) || g.timesUsedInit < 0 || (g.weightG != null && g.weightG <= 0))
        .map((g) => `${g.id}: price ${g.price}, timesUsedInit ${g.timesUsedInit}, weightG ${g.weightG}`),
      garments.length,
      "all amounts valid",
      "negative price or uses, or non-positive weight",
    ),
  "known-tags": ({ garments }) =>
    result(
      garments.flatMap((g) => (g.tags ?? []).filter((t) => !(TAG_IDS as string[]).includes(t)).map((t) => `${g.id}: ${t}`)),
      garments.length,
      "all tags known",
      "unknown tag",
    ),
  "worn-exists": ({ garments, days }) => {
    const entries = Object.entries(days);
    const bad = entries.flatMap(([date, worn]) => worn.filter((i) => !Number.isInteger(i) || i < 0 || i >= garments.length).map((i) => `${date}: index ${i}`));
    const dupes = entries.filter(([, worn]) => new Set(worn).size !== worn.length).map(([date]) => `${date}: duplicate`);
    const outside = entries.filter(([date]) => date < TRACKING_START).map(([date]) => `${date}: before tracking`);
    return result([...bad, ...dupes, ...outside], entries.length, "all worn garments exist", "unknown garment, duplicate or date before tracking");
  },
  "wears-in-ownership": ({ garments, days }) => {
    const bad: string[] = [];
    let wears = 0;
    for (const [date, worn] of Object.entries(days)) {
      for (const i of worn) {
        const g = garments[i];
        if (!g) continue;
        wears++;
        if (date < ownedFrom(g) || date > ownedUntil(g)) bad.push(`${g.id} worn ${date}`);
      }
    }
    return result(bad, wears, "all wears within ownership", "worn outside the ownership period", "warn");
  },
  "public-matches-source": () => ({
    status: "not-checked",
    count: 0,
    total: 0,
    summary: "Needs the owner's private data; checked with a backup (quality-check --source)",
    examples: [],
  }),
  "materials-coverage": ({ garments }, asOf) => {
    const active = garments.filter((g) => ownedFrom(g) <= asOf && asOf <= ownedUntil(g));
    const covered = active.filter((g) => g.weightG && materialsIssue(g.materials) !== "missing" && materialsIssue(g.materials) !== "unreadable");
    const pct = active.length ? Math.round((covered.length / active.length) * 100) : 0;
    return {
      status: "info",
      count: covered.length,
      total: active.length,
      summary: `${pct} % of ${active.length} active garments have a weight and readable materials`,
      examples: [],
    };
  },
};

/** Runs every check, in the catalog's order of `ids`. */
export function runQuality(data: PublicData, ids: string[], asOf: string): QualityResult[] {
  return ids.map((id) => {
    const check = CHECKS[id];
    return check ? { id, ...check(data, asOf) } : { id, status: "not-checked", count: 0, total: 0, summary: "No check implemented", examples: [] };
  });
}

/** JSON with object keys sorted, so the comparison ignores key order (Firestore and backups order keys differently). */
const canonical = (v: unknown): string =>
  JSON.stringify(v ?? null, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/** Compares the public copy with the owner's data from a backup (backup.py format): same garments, same wears. */
export function publicMatchesSource(
  data: PublicData,
  backup: { garments: Record<string, Record<string, unknown>>; days: Record<string, string[]>; settings?: { comparison?: { items?: unknown[] } } },
): Omit<QualityResult, "id"> {
  const bad: string[] = [];
  const pub = new Map(data.garments.map((g) => [g.id, g]));
  for (const [id, g] of Object.entries(backup.garments)) {
    const p = pub.get(id);
    if (!p) { bad.push(`${id}: missing from public data`); continue; }
    for (const [k, v] of Object.entries(g)) {
      if (k === "_history") continue;
      if (canonical((p as unknown as Record<string, unknown>)[k]) !== canonical(v)) bad.push(`${id}.${k} differs`);
    }
  }
  for (const id of pub.keys()) if (!(id in backup.garments)) bad.push(`${id}: not in source`);
  const pubDays = Object.fromEntries(Object.entries(data.days).map(([d, w]) => [d, w.map((i) => data.garments[i]?.id).sort()]));
  for (const [d, worn] of Object.entries(backup.days)) {
    if (JSON.stringify([...worn].sort()) !== JSON.stringify(pubDays[d] ?? [])) bad.push(`${d}: wears differ`);
  }
  for (const d of Object.keys(pubDays)) if (!(d in backup.days)) bad.push(`${d}: not in source`);
  const items = backup.settings?.comparison?.items;
  if (items && canonical(items) !== canonical(data.comparison ?? [])) bad.push("comparison differs");
  return result(bad, Object.keys(backup.garments).length + Object.keys(backup.days).length, "public copy matches the source", "differ from the source");
}
