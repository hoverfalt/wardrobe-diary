// Reads the world-readable users/{uid}/public/data document through Firestore's REST API (no auth needed;
// the same document the public web pages read) and decodes it with the web app's own decoder.
import { decodePublicData, type PublicData, type Wardrobe } from "../../web/src/lib/publicData";

export const PROJECT_ID = "threddit-297417";
export const OWNER_UID = "0q0I90W7W3RAcgFN1c1JX6pZupG3";
const CACHE_MS = 5 * 60 * 1000;

type FirestoreValue = Record<string, unknown>;

/** Firestore REST typed value → plain JSON. */
export function decodeValue(v: FirestoreValue): unknown {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return ((v.arrayValue as { values?: FirestoreValue[] }).values ?? []).map(decodeValue);
  if ("mapValue" in v) return decodeFields((v.mapValue as { fields?: Record<string, FirestoreValue> }).fields ?? {});
  throw new Error(`Unsupported Firestore value: ${Object.keys(v).join(", ")}`);
}

export function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}

let cache: { at: number; wardrobe: Wardrobe } | null = null;

/** The public wardrobe, cached for 5 minutes (one ~0.4 MB document read per refresh). */
export async function loadWardrobe(uid = OWNER_UID, fetchImpl: typeof fetch = fetch): Promise<Wardrobe> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.wardrobe;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/public/data`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Reading the public data failed: HTTP ${res.status}`);
  const doc = (await res.json()) as { fields: Record<string, FirestoreValue> };
  const wardrobe = decodePublicData(decodeFields(doc.fields) as unknown as PublicData);
  cache = { at: Date.now(), wardrobe };
  return wardrobe;
}
