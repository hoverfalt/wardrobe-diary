// Reads the world-readable public data document through Firestore's REST API (no SDK, no sign-in). Shared by
// the MCP server, the /data page's quality checks and the nightly quality check, so all read the data alike.
import type { PublicData } from "./publicData";

export const PROJECT_ID = "threddit-297417";
export const OWNER_UID = "0q0I90W7W3RAcgFN1c1JX6pZupG3";
export const publicDataUrl = (uid = OWNER_UID) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/public/data`;

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

/** The public data document as stored (garments, days as garment indexes, comparison). */
export async function fetchPublicData(uid = OWNER_UID, fetchImpl: typeof fetch = fetch): Promise<PublicData> {
  const res = await fetchImpl(publicDataUrl(uid));
  if (!res.ok) throw new Error(`Reading the public data failed: HTTP ${res.status}`);
  const doc = (await res.json()) as { fields: Record<string, FirestoreValue> };
  return decodeFields(doc.fields) as unknown as PublicData;
}
