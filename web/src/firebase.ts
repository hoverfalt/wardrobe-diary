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

// Garment photos are public PNGs in the Storage bucket root (<id>.png), with 112×112 thumbnails
// under thumbs/<id>_112x112.png. Same assets the live site uses.
export function photoUrl(photo: string, thumb = false): string | null {
  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  if (!photo || !bucket) return null;
  const path = thumb ? `thumbs/${photo}_112x112.png` : `${photo}.png`;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}
