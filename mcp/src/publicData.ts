// Reads the world-readable users/{uid}/public/data document through Firestore's REST API (no auth needed;
// the same document the public web pages read) and decodes it with the web app's own decoder.
import { fetchPublicData, OWNER_UID } from "../../web/src/lib/firestoreRest";
import { decodePublicData, type Wardrobe } from "../../web/src/lib/publicData";

export { decodeFields, decodeValue, OWNER_UID, PROJECT_ID } from "../../web/src/lib/firestoreRest";
const CACHE_MS = 5 * 60 * 1000;

let cache: { at: number; wardrobe: Wardrobe } | null = null;

/** The public wardrobe, cached for 5 minutes (one ~0.4 MB document read per refresh). */
export async function loadWardrobe(uid = OWNER_UID, fetchImpl: typeof fetch = fetch): Promise<Wardrobe> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.wardrobe;
  const wardrobe = decodePublicData(await fetchPublicData(uid, fetchImpl));
  cache = { at: Date.now(), wardrobe };
  return wardrobe;
}
