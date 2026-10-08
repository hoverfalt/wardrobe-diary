import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);

// Offline cache: the full history is small, so it stays on device and logging works offline.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser = () => signOut(auth);

// Garment photos are public PNGs in the Storage bucket root (<id>.png), the same assets the live site
// uses, e.g. https://firebasestorage.googleapis.com/v0/b/threddit-297417.appspot.com/o/Shirts-031.png?alt=media
export function photoUrl(photo: string): string | null {
  return photo ? storageUrl(`${photo}.png`) : null;
}

/** Category images, as on the live site: Category_image-Jackets_and_hoodies.png */
export function categoryImageUrl(category: string): string | null {
  return category ? storageUrl(`Category_image-${category.replaceAll(" ", "_")}.png`) : null;
}

function storageUrl(path: string): string | null {
  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  return bucket ? `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media` : null;
}
