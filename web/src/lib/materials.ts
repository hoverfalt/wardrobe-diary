import { isActive, type DateRange } from "./metrics";
import type { Day, Garment } from "../types";

// Materials (R-30): reads the free-text Materials field (Sheet column J) into fibre compositions, on read;
// the stored text is never changed. Shared by the web app and the MCP server.
//
// Handles the variants in the data: newlines or ";" between items, labelled parts ("Shell: …; Lining: …",
// "Body 84% cotton"), decimal commas, "ja"/"and"/"+" as separators, typos ("cottong", "poilyamide") and
// synonyms (lycra = spandex = elastane, nylon = polyamide, tencel = lyocell, rayon = viscose, …).

export interface Fibre {
  /** Normalised fibre name, e.g. "cotton". */
  fibre: string;
  /** Percent as written (null when the text gives none, e.g. "Leather, rubber"). */
  percent: number | null;
  recycled: boolean;
  organic: boolean;
}

export interface MaterialPart {
  /** "shell", "lining", … (null when the text has no labels). */
  label: string | null;
  fibres: Fibre[];
}

export interface Composition {
  fibre: string;
  /** 0…1 of the main part. */
  share: number;
  recycled: boolean;
  organic: boolean;
}

export interface ParsedMaterials {
  parts: MaterialPart[];
  /** The main part's fibres with shares summing to 1 (empty when unknown). */
  main: Composition[];
  /** Shares guessed (no percentages given: equal split), or percentages not summing to 100. */
  estimated: boolean;
  /** Words that could not be read as a fibre (for cleaning up the source text). */
  unknown: string[];
}

// Synonyms and typos → fibre. Keys are matched after qualifiers are removed and spacing is normalised.
const FIBRES: Record<string, string> = {
  cotton: "cotton", cottong: "cotton", coton: "cotton",
  elastane: "elastane", elastan: "elastane", lycra: "elastane", spandex: "elastane",
  "lycra elastane": "elastane", "elastane/lycra": "elastane", "lycra/elastane": "elastane",
  polyester: "polyester", "polyester-recycled": "polyester",
  polyamide: "polyamide", polyamid: "polyamide", poilyamide: "polyamide", nylon: "polyamide",
  "nylon/polyamide": "polyamide",
  lyocell: "lyocell", lycocell: "lyocell", tencel: "lyocell", "lycocell/tencel": "lyocell", "lyocell/tencel": "lyocell",
  wool: "wool", woll: "wool", "merino wool": "wool", "wool merino": "wool",
  acrylic: "acrylic", akryl: "acrylic",
  modal: "modal",
  viscose: "viscose", rayon: "viscose",
  linen: "linen",
  polypropylene: "polypropylene", polyproylene: "polypropylene", "endurofil/polypropylene": "polypropylene",
  "endurofil/polyproylene": "polypropylene", endurofil: "polypropylene",
  polyurethane: "polyurethane", polyuretane: "polyurethane", pu: "polyurethane",
  leather: "leather", "cow leather": "leather",
  rubber: "rubber", tpr: "rubber",
  down: "down", "goose down": "down", feather: "feather",
  metal: "metal",
  textile: "textile", fabric: "textile", "synthetic textile": "synthetic textile",
};

// Words that qualify a fibre but are not part of its name.
const QUALIFIERS = /\b(organic|recycled|recucled|gots-certified|certified|two-fold|stretch|virgin|new|pima|supima|merino|outside|inside)\b|\(|\)/g;

// Parts considered the garment's main fabric, by how their label begins (otherwise the first part counts).
const MAIN_LABEL = /^(shell|main|outer|body|fabric|belt)\b/;

// A part label: "shell:" / "lining 2:" anywhere, or words directly before a number ("padding 100% …").
const LABEL_COLON = /^([a-z][a-z0-9 &]*?)\s*:\s*/;
const LABEL_BEFORE_NUMBER = /^([a-z][a-z ]*?)\s+(?=\d)/;

function parseFibre(item: string): Fibre | string | null {
  let t = item.trim();
  if (!t) return null;
  let percent: number | null = null;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*%?\s*(.*)$/);
  if (m) {
    percent = Number(m[1]);
    t = m[2];
  }
  const recycled = /recycled|recucled|-recycled/.test(t);
  const organic = /organic/.test(t);
  const name = t
    .replace(/-recycled/g, "")
    .replace(QUALIFIERS, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  const fibre = FIBRES[name] ?? FIBRES[name.replace(/\s+/g, "")];
  if (!fibre) return name || null; // unknown word
  return { fibre, percent, recycled, organic };
}

export function parseMaterials(text: string | null | undefined): ParsedMaterials {
  const empty: ParsedMaterials = { parts: [], main: [], estimated: false, unknown: [] };
  if (!text || /^\s*na\b/i.test(text)) return empty;

  const normalised = text
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2") // decimal commas
    .replace(/\s*\n\s*/g, "; ")
    .replace(/\.\s+(?=[a-z])/g, "; ") // sentences
    .replace(/[.]\s*$/, "")
    .replace(/\bshee+l+\b/g, "shell") // "sheel", "sheell"
    // Labels like "shell and lining:" must not be split at "and": write them with "&".
    .replace(/\b([a-z]+) and ([a-z0-9 ]+?):/g, "$1 & $2:");
  // Items are separated by ";", newlines, ",", "+", "ja", "and", "with". A labelled item ("lining: …",
  // "padding 100% …") starts a new part; unlabelled items continue the current one.
  const items = normalised.split(/\s*(?:;|,|\+|\bja\b|\band\b|\bwith\b)\s*/);
  const parts: MaterialPart[] = [];
  const unknown: string[] = [];
  let current: MaterialPart | null = null;
  for (let item of items) {
    item = item.trim();
    if (!item) continue;
    const m = item.match(LABEL_COLON) ?? item.match(LABEL_BEFORE_NUMBER);
    if (m) {
      current = { label: m[1].trim(), fibres: [] };
      parts.push(current);
      item = item.slice(m[0].length);
    }
    const f = parseFibre(item);
    if (f === null) continue;
    if (typeof f === "string") {
      if (!/membrane|gore-tex|hand made|balance material/.test(f)) unknown.push(f);
      continue;
    }
    if (!current) {
      current = { label: null, fibres: [] };
      parts.push(current);
    }
    current.fibres.push(f);
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].fibres.length === 0) parts.splice(i, 1);
  if (parts.length === 0) return { ...empty, unknown };

  const main = parts.find((p) => p.label && MAIN_LABEL.test(p.label)) ?? parts[0];
  const known = main.fibres.filter((f) => f.percent != null);
  let estimated = false;
  let composition: Composition[];
  if (known.length === main.fibres.length) {
    const sum = known.reduce((s, f) => s + f.percent!, 0);
    estimated = Math.abs(sum - 100) > 0.5;
    composition = main.fibres.map((f) => ({ fibre: f.fibre, share: f.percent! / sum, recycled: f.recycled, organic: f.organic }));
  } else {
    estimated = true;
    composition = main.fibres.map((f) => ({ fibre: f.fibre, share: 1 / main.fibres.length, recycled: f.recycled, organic: f.organic }));
  }
  // The same fibre listed twice (e.g. "60% cotton, 40% pima cotton") is one entry.
  const merged = new Map<string, Composition>();
  for (const c of composition) {
    const key = c.fibre;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, share: prev.share + c.share, recycled: prev.recycled || c.recycled, organic: prev.organic || c.organic } : c);
  }
  return { parts, main: [...merged.values()].sort((a, b) => b.share - a.share), estimated, unknown };
}

export interface FibreMass {
  fibre: string;
  kg: number;
  /** Share of the total known mass. */
  share: number;
  recycledKg: number;
  organicKg: number;
}

export interface MaterialBreakdown {
  basis: "owned" | "worn";
  totalKg: number;
  fibres: FibreMass[];
  /** How much of the data could be used: garments (owned) or wears (worn) with both a weight and readable
   *  materials, out of all; plus how many of those rest on estimated shares. */
  coverage: { included: number; total: number; missingWeight: number; missingMaterials: number; estimated: number };
  /** Worn basis only: average weight of the garments worn per logged day (garments with a known weight). */
  averageOutfitKg?: number;
}

/** Fibre mass owned (garments active at the end of the range) or worn (every wear in the range counts the
 *  garment's full weight), from weight × main-part composition. */
export function materialBreakdown(
  garments: Garment[],
  days: Day[],
  range: DateRange,
  basis: "owned" | "worn",
): MaterialBreakdown {
  const parsed = new Map(garments.map((g) => [g.id, parseMaterials(g.materials)]));
  const mass = new Map<string, FibreMass>();
  const coverage = { included: 0, total: 0, missingWeight: 0, missingMaterials: 0, estimated: 0 };
  const add = (g: Garment, times: number) => {
    coverage.total += times;
    const p = parsed.get(g.id)!;
    if (!g.weightG) coverage.missingWeight += times;
    if (p.main.length === 0) coverage.missingMaterials += times;
    if (!g.weightG || p.main.length === 0) return;
    coverage.included += times;
    if (p.estimated) coverage.estimated += times;
    for (const c of p.main) {
      const kg = (g.weightG * c.share * times) / 1000;
      const m = mass.get(c.fibre) ?? { fibre: c.fibre, kg: 0, share: 0, recycledKg: 0, organicKg: 0 };
      m.kg += kg;
      if (c.recycled) m.recycledKg += kg;
      if (c.organic) m.organicKg += kg;
      mass.set(c.fibre, m);
    }
  };

  let averageOutfitKg: number | undefined;
  if (basis === "owned") {
    for (const g of garments) if (isActive(g, range.to)) add(g, 1);
  } else {
    const byId = new Map(garments.map((g) => [g.id, g]));
    let dayKg = 0;
    let loggedDays = 0;
    for (const d of days) {
      if (d.date < range.from || d.date > range.to) continue;
      let any = false;
      for (const id of d.worn) {
        const g = byId.get(id);
        if (!g || !isActive(g, d.date)) continue;
        add(g, 1);
        any = true;
        if (g.weightG) dayKg += g.weightG / 1000;
      }
      if (any) loggedDays++;
    }
    averageOutfitKg = loggedDays ? dayKg / loggedDays : 0;
  }

  const totalKg = [...mass.values()].reduce((s, m) => s + m.kg, 0);
  const fibres = [...mass.values()].map((m) => ({ ...m, share: totalKg ? m.kg / totalKg : 0 })).sort((a, b) => b.kg - a.kg);
  return { basis, totalKg, fibres, coverage, ...(basis === "worn" ? { averageOutfitKg } : {}) };
}
