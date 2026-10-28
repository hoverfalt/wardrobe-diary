// Match a spoken (dictated) description to one garment (ROADMAP R-44): "black Diesel boxers", "Haglöfs jacket",
// "Jockey white number four". Runs on the phone, offline, no AI. Pure and tested (voiceMatch.test.ts).
//
// How it scores: the description and every candidate garment are reduced to normalised words (diacritics,
// plurals, brand spellings, synonyms such as tee = t-shirt). Each spoken word scores by how distinctive the
// garment word it matches is (rare words like brands count more than "black"), allowing small dictation errors.
// Numbers: a spoken number picks the garment with that number ("4" = "04"). Without one, a group of identical
// garments (same name apart from the number) is represented by the one worn longest ago, to keep the rotation;
// in a rotation series the owner has marked (lib/rotation.ts), by the next in line instead, as on its Log tile.
import type { Garment, IsoDate } from "../types";

export interface MatchCandidate {
  garment: Garment;
  score: number;
  /** Garments of the same identical group that this one stands for (when no number was said). */
  groupSize: number;
}

export interface MatchResult {
  /** Normalised words of the description, as matched. */
  words: string[];
  /** "match": the best matches for a specific description. "browse": only a garment type was said (or the other
   *  words fit nothing of that type), so the candidates are that type's garments, most worn lately first. */
  mode: "match" | "browse";
  /** Browse mode: the spoken words that fit no garment of the type (e.g. ["cozy"]). */
  unplaced: string[];
  candidates: MatchCandidate[];
}

// ---------- normalisation ----------
const STOP = new Set(["the", "a", "an", "my", "and", "with", "w", "of", "today", "i", "wore", "wearing", "worn", "pair", "number", "no", "one's", "please", "some", "that", "this", "it"]);
/** Spoken forms → the words garment names use (applied to the description and the garments alike). */
const PHRASES: [RegExp, string][] = [
  [/\bh\s*(?:&|and|n)\s*m\b/g, " hm "],
  [/\bg[\s-]*star\b/g, " gstar "],
  [/\bt[\s-]*shirts?\b/g, " tshirt "],
  [/\btees?\b/g, " tshirt "],
  [/\bunder\s*shirts?\b|\bundershirts?\b/g, " underwear shirt "],
  [/\bunder\s*pants\b|\bunderpants\b|\bbriefs?\b|\btrunks?\b/g, " boxer "],
  [/\bjack\s*(?:&|and|n)\s*jones\b/g, " jackjones "],
  [/\bmister\b/g, " mr "],
  [/\bhoody\b/g, " hoodie "],
];
const SYNONYMS: Record<string, string> = {
  grey: "gray", trainer: "sneaker", runner: "sneaker", trouser: "pant", jumper: "knit", sweater: "knit", cardigan: "knit",
  navy: "navy", denim: "jean", tank: "tank", singlet: "tank", vest: "vest", polos: "polo", blazers: "blazer",
};
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

/** Words naming a type of garment, and the category word they belong to. If one is said, a garment that matches
 *  it neither in its name nor its category is left out (saying "boxers" rules out belts). Category words count
 *  as type words too (added from the candidates). */
const TYPE_CATEGORY: Record<string, string> = {
  sneaker: "shoe", boot: "shoe", shoe: "shoe", jean: "pant", chino: "pant", pant: "pant", short: "short", sock: "sock",
  boxer: "boxer", underwear: "underwear", shirt: "shirt", tshirt: "tshirt", tank: "tank", polo: "tshirt", pique: "tshirt",
  hoodie: "hoodie", jacket: "jacket", college: "jacket", vest: "vest", blazer: "blazer", knit: "knit", belt: "belt",
};

const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

/** Lower case, no diacritics or punctuation, phrases and synonyms applied, plurals stemmed. */
export function normalise(text: string): string[] {
  let t = ` ${text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()} `;
  t = t.replace(/[’']/g, "");
  for (const [re, to] of PHRASES) t = t.replace(re, to);
  return t
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => SYNONYMS[w] ?? w)
    .map(stem);
}

/** Numbers in a description: digits ("04", "4") and spoken forms ("four", "zero four", "oh four"). */
export function spokenNumbers(words: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^\d+$/.test(w)) out.push(Number(w));
    else if (w in NUMBER_WORDS) {
      // "zero four" / "oh four" → 4 (the zero is a leading zero); a lone "oh"/"zero" means 0 only at the end.
      if ((w === "zero" || w === "oh") && words[i + 1] in NUMBER_WORDS) continue;
      // "one" is usually a pronoun ("the quilted one"): a number only as "number one", "zero one" or "oh one".
      if (w === "one" && !["number", "zero", "oh", "no"].includes(words[i - 1] ?? "")) continue;
      out.push(NUMBER_WORDS[w]);
    }
  }
  return out;
}

const numbersIn = (words: string[]) => words.filter((w) => /^\d+$/.test(w)).map(Number);
/** Name without its trailing number: the identical group ("Jockey white 04" → "jockey white"). */
export const groupKey = (g: Pick<Garment, "category" | "item">) =>
  `${g.category}|${normalise(g.item.replace(/\s*\(.*\)\s*$/, "").replace(/\s+\d{1,2}$/, "")).join(" ")}`;

// ---------- similarity ----------
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/** 1 for the same word, less for a prefix or a small dictation error, 0 otherwise. */
function similarity(q: string, t: string): number {
  if (q === t) return 1;
  if (/^\d+$/.test(q) || /^\d+$/.test(t)) return 0; // numbers are handled separately
  if (q.length >= 3 && t.length >= 3 && (t.startsWith(q) || q.startsWith(t))) return 0.8;
  if (q.length >= 4 && editDistance(q, t, 1) <= 1) return 0.7;
  if (q.length >= 7 && editDistance(q, t, 2) <= 2) return 0.5;
  return 0;
}

// ---------- matching ----------
interface Doc {
  g: Garment;
  name: string[];
  details: string[];
  category: string[];
  numbers: number[];
  group: string;
}

/**
 * Ranks the candidate garments for a description. `candidates` are the garments that can be logged (active that
 * day, not yet logged, within the Log filters); `lastWorn` gives each garment's last wear before the day (for the
 * rotation rule); `recent` how often each was worn lately (a small nudge towards everyday garments); `rotation`
 * each garment of a marked rotation series → its place in line (0 = next), which takes precedence over `lastWorn`.
 */
export function matchGarment(
  description: string,
  candidates: Garment[],
  lastWorn: Map<string, IsoDate>,
  recent: Map<string, number> = new Map(),
  rotation: Map<string, number> = new Map(),
  limit = 4,
  browseLimit = 8,
): MatchResult {
  const all = normalise(description);
  const numbers = spokenNumbers(all);
  const words = all.filter((w) => !STOP.has(w) && !(w in NUMBER_WORDS) && !/^\d+$/.test(w));
  const docs: Doc[] = candidates.map((g) => {
    const name = normalise(g.item);
    return { g, name, details: normalise(g.details ?? ""), category: normalise(g.category), numbers: numbersIn(name), group: groupKey(g) };
  });
  // How distinctive each garment word is: rare words (brands, models) count more than common ones ("black").
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set([...d.name, ...d.details, ...d.category])) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = (w: string) => Math.log(1 + docs.length / (df.get(w) ?? 1));
  const categoryWords = new Set(docs.flatMap((d) => d.category));
  const hits = (d: Doc, q: string) =>
    [...d.name, ...d.category, ...d.details].some((t) => (df.has(q) ? q === t : similarity(q, t) > 0)) ||
    (q in TYPE_CATEGORY && d.category.includes(TYPE_CATEGORY[q]));
  // Spoken garment types: keep only garments of that type, when there are any.
  const typeWords = words.filter((q) => q in TYPE_CATEGORY || categoryWords.has(q));
  const ofType = (d: Doc) => typeWords.every((q) => hits(d, q));
  const typed = typeWords.length && docs.some(ofType) ? docs.filter(ofType) : docs;

  // Browse: a type was said and nothing else narrows it down (no other words, or none that fit this type).
  const otherWords = words.filter((q) => !typeWords.includes(q));
  const unplaced = otherWords.filter((q) => !typed.some((d) => hits(d, q)));
  if (typeWords.length && typed !== docs && unplaced.length === otherWords.length) {
    return { words, mode: "browse", unplaced, candidates: browse(typed, lastWorn, inTurn(lastWorn, rotation), recent, browseLimit) };
  }

  const scored = typed
    .map((d) => {
      let score = 0;
      for (const q of words) {
        // A word that exists in the wardrobe counts only where it appears exactly; prefixes and small spelling
        // differences are for words that don't exist (dictation errors), so "black" never matches "blank".
        const known = df.has(q);
        let best = 0;
        for (const [field, weight] of [[d.name, 1], [d.category, 0.6], [d.details, 0.4]] as const) {
          for (const t of field) {
            const sim = known ? (q === t ? 1 : 0) : similarity(q, t);
            const viaType = field === d.category && q in TYPE_CATEGORY && t === TYPE_CATEGORY[q] ? 0.8 : 0;
            const s = Math.max(sim, viaType) * weight * idf(t);
            if (s > best) best = s;
          }
        }
        score += best;
      }
      // Every spoken word should find something: unmatched words make a candidate less likely, and an unmatched
      // garment type ("boxers" for a belt) much less likely.
      for (const q of words) {
        if (!hits(d, q)) score -= 0.5;
      }
      if (numbers.length) score += numbers.some((n) => d.numbers.includes(n)) ? 3 : d.numbers.length ? -2 : 0;
      // The recent-wear nudge only ranks different garments, never members of an identical group (rotation).
      return { d, score, nudged: score + Math.log(1 + (recent.get(d.g.id) ?? 0)) * 0.15 };
    })
    .filter((x) => x.score > 0 && words.length > 0);

  // Identical groups: without a spoken number, the group's representative is the one worn longest ago among its
  // (near-)best matches, ignoring the small recent-wear nudge, which would otherwise undo the rotation.
  const groups = new Map<string, { d: Doc; score: number; nudged: number }[]>();
  for (const x of scored) {
    const key = numbers.length ? x.d.g.id : x.d.group;
    groups.set(key, [...(groups.get(key) ?? []), x]);
  }
  const order = inTurn(lastWorn, rotation);
  const best = [...groups.values()].map((members) => {
    const top = Math.max(...members.map((m) => m.score));
    const pick = members.filter((m) => m.score >= top - 0.5).sort((a, b) => order(a.d.g, b.d.g))[0];
    return { d: pick.d, score: Math.max(...members.map((m) => m.nudged)), size: members.length };
  });
  const candidatesOut = best
    .sort((a, b) => b.score - a.score || a.d.g.item.localeCompare(b.d.g.item))
    .slice(0, limit)
    .map((x) => ({ garment: x.d.g, score: Math.round(x.score * 100) / 100, groupSize: x.size }));
  return { words, mode: "match", unplaced: [], candidates: candidatesOut };
}

/** A garment type's garments for picking by photo: identical groups collapsed (shown by the one worn longest ago,
 *  for the rotation), groups ordered by how often they were worn lately (a group's wears added up). */
function browse(
  docs: Doc[],
  lastWorn: Map<string, IsoDate>,
  order: (a: Garment, b: Garment) => number,
  recent: Map<string, number>,
  limit: number,
): MatchCandidate[] {
  const groups = new Map<string, Doc[]>();
  for (const d of docs) groups.set(d.group, [...(groups.get(d.group) ?? []), d]);
  const lastOf = (d: Doc) => lastWorn.get(d.g.id) ?? "";
  return [...groups.values()]
    .map((members) => ({
      pick: [...members].sort((a, b) => order(a.g, b.g))[0],
      wears: members.reduce((s, m) => s + (recent.get(m.g.id) ?? 0), 0),
      latest: members.map(lastOf).sort().pop() ?? "",
      size: members.length,
    }))
    .sort((a, b) => b.wears - a.wears || b.latest.localeCompare(a.latest) || a.pick.g.item.localeCompare(b.pick.g.item))
    .slice(0, limit)
    .map((x) => ({ garment: x.pick.g, score: x.wears, groupSize: x.size }));
}

/** Which of two identical garments comes first in turn: a marked rotation series' next in line, otherwise the one
 *  worn longest ago (never worn first), then the name. */
function inTurn(lastWorn: Map<string, IsoDate>, rotation: Map<string, number>) {
  return (a: Garment, b: Garment) =>
    (rotation.get(a.id) ?? Infinity) - (rotation.get(b.id) ?? Infinity) ||
    (lastWorn.get(a.id) ?? "").localeCompare(lastWorn.get(b.id) ?? "") ||
    a.item.localeCompare(b.item);
}

/** Each garment's last wear before `date` (for the rotation rule). */
export function lastWornBefore(days: { date: IsoDate; worn: string[] }[], date: IsoDate): Map<string, IsoDate> {
  const out = new Map<string, IsoDate>();
  for (const d of days) {
    if (d.date >= date) continue;
    for (const id of d.worn) if ((out.get(id) ?? "") < d.date) out.set(id, d.date);
  }
  return out;
}
