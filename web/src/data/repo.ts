import {
  collection,
  deleteField,
  doc,
  FieldPath,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import type { ComparisonItem } from "../lib/comparison";
import type { GarmentFields } from "../lib/garmentForm";
import { decodePublicData, withGarments, withoutGarment, type PublicData, type Wardrobe } from "../lib/publicData";
import type { IsoDate } from "../types";

/** Logs a day's worn garments (the app is the source of truth for wears since 2026-10-09). One batch
 *  writes days/{date} and the same day in the public data (as garment indexes), so public pages update
 *  at once. Batches work offline: the SDK queues them and syncs when back online. */
export function setDayWorn(uid: string, date: IsoDate, ids: string[], indexes: number[]): Promise<void> {
  const batch = writeBatch(db);
  const dayRef = doc(db, "users", uid, "days", date);
  if (ids.length > 0) batch.set(dayRef, { worn: ids });
  else batch.delete(dayRef);
  batch.update(doc(db, "users", uid, "public", "data"), new FieldPath("days", date), indexes.length > 0 ? indexes : deleteField());
  return batch.commit();
}

/** Whether local changes to the public data are still waiting to reach the server (e.g. offline). */
export function usePendingWrites(uid: string): boolean {
  const [pending, setPending] = useState(false);
  useEffect(
    () =>
      onSnapshot(doc(db, "users", uid, "public", "data"), { includeMetadataChanges: true }, (snap) =>
        setPending(snap.metadata.hasPendingWrites),
      ),
    [uid],
  );
  return pending;
}

/** The owner's public wardrobe; null while loading. Readable without signing in. */
export function usePublicWardrobe(ownerUid: string): Wardrobe | null {
  const [wardrobe, setWardrobe] = useState<Wardrobe | null>(null);
  useEffect(
    () =>
      onSnapshot(doc(db, "users", ownerUid, "public", "data"), (snap) =>
        setWardrobe(snap.exists() ? decodePublicData(snap.data() as PublicData) : { garments: [], days: [], comparison: [] }),
      ),
    [ownerUid],
  );
  return wardrobe;
}

/** Saves garments' details (decision D-4: Firestore is the source of truth) in one transaction: each
 *  previous version goes to garments/{id}/history, each garment is replaced, and their entries in the
 *  public data document are updated so public pages show the change immediately. Used for single edits
 *  and bulk edits (≤ 240 garments per call: two writes each, Firestore allows 500 per transaction). */
export async function saveGarments(uid: string, updates: { id: string; fields: GarmentFields; note?: string }[]): Promise<void> {
  return updateGarments(uid, updates.map((u) => ({ id: u.id, update: () => u.fields, note: u.note })));
}

/** Bulk edits: each garment's new fields are computed from its stored version inside the transaction,
 *  so a change never overwrites a garment from a stale copy. */
export async function updateGarments(
  uid: string,
  updates: { id: string; update: (current: GarmentFields) => GarmentFields; note?: string }[],
): Promise<void> {
  if (updates.length > 240) throw new Error("Too many garments in one save (max 240)");
  const publicRef = doc(db, "users", uid, "public", "data");
  await runTransaction(db, async (tx) => {
    const pub = await tx.get(publicRef);
    const refs = updates.map((u) => doc(db, "users", uid, "garments", u.id));
    const current = await Promise.all(refs.map((r) => tx.get(r)));
    current.forEach((c, i) => {
      if (!c.exists()) throw new Error(`Garment ${updates[i].id} not found`);
    });
    const next = updates.map((u, i) => u.update(current[i].data() as GarmentFields));
    updates.forEach((u, i) => {
      const history = doc(collection(db, "users", uid, "garments", u.id, "history"));
      tx.set(history, { savedAt: serverTimestamp(), before: current[i].data(), after: next[i], ...(u.note ? { note: u.note } : {}) });
      tx.set(refs[i], next[i]);
    });
    if (pub.exists()) {
      const updated = withGarments(pub.data() as PublicData, updates.map((u, i) => ({ id: u.id, ...next[i] })));
      tx.update(publicRef, { garments: updated.garments });
    }
  });
}

export function saveGarment(uid: string, id: string, fields: GarmentFields, note?: string): Promise<void> {
  return saveGarments(uid, [{ id, fields, note }]);
}

/** Deletes a garment that has never been worn (R-27 phase c), in one transaction: refuses if any day in
 *  the public data lists it or it has pre-tracking wears; keeps a record in deletedGarments/{id} (so the
 *  Sheet sync won't re-create it from an old row, and as an audit trail); removes it from the public data,
 *  shifting the day indexes. The photo file stays in Storage (deletes are not allowed there). */
export async function deleteGarment(uid: string, id: string): Promise<void> {
  const garmentRef = doc(db, "users", uid, "garments", id);
  const publicRef = doc(db, "users", uid, "public", "data");
  const deletedRef = doc(db, "users", uid, "deletedGarments", id);
  await runTransaction(db, async (tx) => {
    const [current, pub] = [await tx.get(garmentRef), await tx.get(publicRef)];
    if (!current.exists()) throw new Error(`Garment ${id} not found`);
    const fields = current.data() as GarmentFields;
    if (fields.timesUsedInit > 0) throw new Error("This garment has wears from before tracking began; divest it instead.");
    if (pub.exists()) {
      const data = pub.data() as PublicData;
      const i = data.garments.findIndex((g) => g.id === id);
      if (i >= 0 && Object.values(data.days).some((worn) => worn.includes(i)))
        throw new Error("This garment has logged wears; divest it instead.");
      tx.set(publicRef, withoutGarment(data, id));
    }
    tx.set(deletedRef, { deletedAt: serverTimestamp(), garment: fields });
    tx.delete(garmentRef);
  });
}

export interface HistoryEntry {
  id: string;
  savedAt: Date | null;
  /** null when the garment was created in the app. */
  before: GarmentFields | null;
  /** e.g. "Photo replaced" */
  note?: string;
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
              return { id: d.id, savedAt: (v.savedAt as Timestamp | null)?.toDate() ?? null, before: v.before, after: v.after, note: v.note };
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

/** The comparison items as stored (users/{uid}/settings/comparison, R-26); [] when none, undefined while loading. */
export function useComparison(uid: string): ComparisonItem[] | undefined {
  const [items, setItems] = useState<ComparisonItem[] | undefined>(undefined);
  useEffect(
    () =>
      onSnapshot(doc(db, "users", uid, "settings", "comparison"), (snap) =>
        setItems(snap.exists() ? ((snap.data().items ?? []) as ComparisonItem[]) : []),
      ),
    [uid],
  );
  return items;
}

/** Changes the comparison items in one transaction: the new list is computed from the stored one and
 *  written both to settings/comparison (backed up with the settings) and to the public data. */
export async function updateComparison(uid: string, update: (items: ComparisonItem[]) => ComparisonItem[]): Promise<void> {
  const ref = doc(db, "users", uid, "settings", "comparison");
  const publicRef = doc(db, "users", uid, "public", "data");
  await runTransaction(db, async (tx) => {
    const [current, pub] = [await tx.get(ref), await tx.get(publicRef)];
    const items = update(current.exists() ? ((current.data().items ?? []) as ComparisonItem[]) : []);
    tx.set(ref, { items });
    if (pub.exists()) tx.update(publicRef, { comparison: items });
  });
}
