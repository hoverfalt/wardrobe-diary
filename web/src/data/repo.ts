import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import type { GarmentFields } from "../lib/garmentForm";
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

/** Saves a garment's details (decision D-4: Firestore is the source of truth) in one transaction:
 *  the previous version goes to garments/{id}/history, the garment is replaced, and its entry in the
 *  public data document is updated so public pages show the change immediately. */
export async function saveGarment(uid: string, id: string, fields: GarmentFields): Promise<void> {
  const garmentRef = doc(db, "users", uid, "garments", id);
  const publicRef = doc(db, "users", uid, "public", "data");
  const historyRef = doc(collection(db, "users", uid, "garments", id, "history"));
  await runTransaction(db, async (tx) => {
    const [current, pub] = [await tx.get(garmentRef), await tx.get(publicRef)];
    if (!current.exists()) throw new Error(`Garment ${id} not found`);
    tx.set(historyRef, { savedAt: serverTimestamp(), before: current.data(), after: fields });
    tx.set(garmentRef, fields);
    if (pub.exists()) {
      const data = pub.data() as PublicData;
      const i = data.garments.findIndex((g) => g.id === id);
      if (i >= 0) {
        const garments = [...data.garments];
        garments[i] = { id, ...fields };
        tx.update(publicRef, { garments });
      }
    }
  });
}

export interface HistoryEntry {
  id: string;
  savedAt: Date | null;
  /** null when the garment was created in the app. */
  before: GarmentFields | null;
  after: GarmentFields;
}

/** A garment's saved versions, newest first. */
export function useGarmentHistory(uid: string, id: string): HistoryEntry[] | null {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "users", uid, "garments", id, "history"), orderBy("savedAt", "desc")),
        (snap) =>
          setEntries(
            snap.docs.map((d) => {
              const v = d.data();
              return { id: d.id, savedAt: (v.savedAt as Timestamp | null)?.toDate() ?? null, before: v.before, after: v.after };
            }),
          ),
      ),
    [uid, id],
  );
  return entries;
}

/** One garment as stored (the authoritative copy, not the public one). */
export function useGarment(uid: string, id: string): GarmentFields | null | undefined {
  const [garment, setGarment] = useState<GarmentFields | null | undefined>(undefined);
  useEffect(
    () => onSnapshot(doc(db, "users", uid, "garments", id), (snap) => setGarment(snap.exists() ? (snap.data() as GarmentFields) : null)),
    [uid, id],
  );
  return garment;
}

/** Creates a garment (R-27 phase b) in one transaction: the garment doc (refused if the id is taken),
 *  a history entry with no previous version, and its entry appended to the public data document. */
export async function createGarment(uid: string, id: string, fields: GarmentFields): Promise<void> {
  const garmentRef = doc(db, "users", uid, "garments", id);
  const publicRef = doc(db, "users", uid, "public", "data");
  const historyRef = doc(collection(db, "users", uid, "garments", id, "history"));
  await runTransaction(db, async (tx) => {
    const [existing, pub] = [await tx.get(garmentRef), await tx.get(publicRef)];
    if (existing.exists()) throw new Error(`Photo id ${id} is already in use`);
    tx.set(garmentRef, fields);
    tx.set(historyRef, { savedAt: serverTimestamp(), before: null, after: fields });
    if (pub.exists()) {
      const data = pub.data() as PublicData;
      tx.update(publicRef, { garments: [...data.garments, { id, ...fields }] });
    }
  });
}
