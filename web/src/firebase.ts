import { initializeApp } from "firebase/app";
import { connectAuthEmulator, GoogleAuthProvider, getAuth, signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

/** Local testing against the Firebase emulators (`npm run dev:emulator`, see tools/emulator.sh): auth, Firestore
 *  and Storage are local copies seeded from a backup, so nothing touches production. Never set in production. */
export const EMULATORS = import.meta.env.VITE_USE_EMULATORS === "true";
/** The stand-in owner account created by tools/seed_emulator.py (emulator only). */
export const EMULATOR_OWNER = { email: "owner@emulator.test", password: "emulator-only" };

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);

/** Whose wardrobe the public pages show. */
export const OWNER_UID: string = import.meta.env.VITE_OWNER_UID;

// Offline cache: the full history is small, so it stays on device and logging works offline.
// (In emulator mode an in-memory cache, so local test data never mixes with the real offline cache.)
export const db = initializeFirestore(app, {
  localCache: EMULATORS ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (EMULATORS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

/** The Storage SDK is only needed for uploads (owner), so it is loaded on first use, not for every visitor. */
let storageEmulatorConnected = false;
async function uploadPng(path: string, file: Blob): Promise<void> {
  const { connectStorageEmulator, getStorage, ref, uploadBytes } = await import("firebase/storage");
  const storage = getStorage(app);
  if (EMULATORS && !storageEmulatorConnected) {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    storageEmulatorConnected = true;
  }
  await uploadBytes(ref(storage, path), file, { contentType: "image/png" });
}

// In emulator mode "Sign in" signs in as the seeded stand-in owner directly (no Google popup).
export const signIn = () =>
  EMULATORS ? signInWithEmailAndPassword(auth, EMULATOR_OWNER.email, EMULATOR_OWNER.password) : signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser = () => signOut(auth);

// Garment photos are public PNGs in the Storage bucket root (<id>.png), the same assets the live site
// uses, e.g. https://firebasestorage.googleapis.com/v0/b/threddit-297417.appspot.com/o/Shirts-031.png?alt=media
export function photoUrl(g: { photo: string; photoVersion?: string | null }): string | null {
  const url = g.photo ? storageUrl(`${g.photo}.png`) : null;
  // The file name stays the same when a photo is replaced; the version makes it a new URL.
  return url && g.photoVersion ? `${url}&v=${encodeURIComponent(g.photoVersion)}` : url;
}

/** A comparison item's photo (R-26): Comparison-<Name>.png next to the garment photos; like garments, the
 *  photo version makes a replaced photo a new URL. Items without a photo have an empty `photo`. */
export function comparisonPhotoUrl(c: { photo: string; photoVersion?: string | null }): string | null {
  return photoUrl(c);
}

/** Category images, as on the live site: Category_image-Jackets_and_hoodies.png */
export function categoryImageUrl(category: string): string | null {
  return category ? storageUrl(`Category_image-${category.replaceAll(" ", "_")}.png`) : null;
}

function storageUrl(path: string): string | null {
  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  return bucket ? `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media` : null;
}

/** Uploads a garment photo as <photo>.png at the bucket root, next to the existing ones. storage.rules
 *  allow this only for the owner, PNG, under 5 MB, and Photo ids like Jackets_and_hoodies-035. */
export async function uploadGarmentPhoto(photo: string, file: Blob): Promise<void> {
  await uploadPng(`${photo}.png`, file);
}

/** Uploads a comparison photo as Comparison-<Name>.png (storage.rules allow that name pattern too). */
export async function uploadComparisonPhoto(photo: string, file: Blob): Promise<void> {
  await uploadPng(`${photo}.png`, file);
}
