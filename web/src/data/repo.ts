import { arrayRemove, arrayUnion, collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { decodePublicData, type PublicData, type Wardrobe } from "../lib/publicData";
import type { Day, Garment, IsoDate } from "../types";

export function useGarments(uid: string): Garment[] | null {
  const [garments, setGarments] = useState<Garment[] | null>(null);
  useEffect(
    () =>
      onSnapshot(collection(db, "users", uid, "garments"), (snap) =>
        setGarments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Garment, "id">) }))),
      ),
    [uid],
  );
  return garments;
}

export function useDays(uid: string): Day[] | null {
  const [days, setDays] = useState<Day[] | null>(null);
  useEffect(
    () =>
      onSnapshot(collection(db, "users", uid, "days"), (snap) =>
        setDays(
          snap.docs
            .map((d) => ({ date: d.id, worn: (d.data().worn as string[]) ?? [] }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        ),
      ),
    [uid],
  );
  return days;
}

export function setWorn(uid: string, date: IsoDate, garmentId: string, worn: boolean) {
  return setDoc(
    doc(db, "users", uid, "days", date),
    { worn: worn ? arrayUnion(garmentId) : arrayRemove(garmentId) },
    { merge: true },
  );
}

/** The owner's public wardrobe; null while loading. Readable without signing in. */
export function usePublicWardrobe(ownerUid: string): Wardrobe | null {
  const [wardrobe, setWardrobe] = useState<Wardrobe | null>(null);
  useEffect(
    () =>
      onSnapshot(doc(db, "users", ownerUid, "public", "data"), (snap) =>
        setWardrobe(snap.exists() ? decodePublicData(snap.data() as PublicData) : { garments: [], days: [] }),
      ),
    [ownerUid],
  );
  return wardrobe;
}
