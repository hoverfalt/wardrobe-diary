// Edit one garment (R-27 phase a, owner only). Details are stored in Firestore (D-4); every save keeps
// the previous version in the garment's history, which can be restored into the form.
import { useEffect, useMemo, useState } from "react";
import { formatEur2 } from "../components/CategoryCharts";
import { Link } from "../components/Link";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { deleteGarment, saveGarment, setRotationSeries, useGarment, useGarmentHistory, useRotationSeries } from "../data/repo";
import { photoUrl, uploadGarmentPhoto } from "../firebase";
import { navigate } from "../lib/route";
import { formatFi, todayIso } from "../lib/dates";
import { GarmentFormFields, LABELS } from "../components/GarmentFormFields";
import { changedFields, parseGarmentForm, toForm, type FormErrors, type GarmentForm } from "../lib/garmentForm";
import { isActive, itemListing, TRACKING_START, wearIndex } from "../lib/metrics";
import { rotationOrder, seriesOf } from "../lib/rotation";
import type { Wardrobe } from "../lib/publicData";


export function GarmentEditPage({ uid, id, wardrobe }: { uid: string; id: string; wardrobe: Wardrobe | null }) {
  const stored = useGarment(uid, id);
  const history = useGarmentHistory(uid, id);
  const [form, setForm] = useState<GarmentForm | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [newPhoto, setNewPhoto] = useState<PickedPhoto | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [photoStatus, setPhotoStatus] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // Fill the form once the stored garment has loaded (and again after navigating to another garment).
  useEffect(() => setForm(null), [id]);
  useEffect(() => {
    if (stored && form === null) setForm(toForm(stored));
  }, [stored, form]);

  const stats = useMemo(() => {
    if (!wardrobe) return null;
    const g = wardrobe.garments.find((x) => x.id === id);
    if (!g) return null;
    const [row] = itemListing([g], wardrobe.days, { from: TRACKING_START, to: todayIso() });
    return row ?? null;
  }, [wardrobe, id]);

  if (stored === undefined || (stored && !form)) return <p>Loading…</p>;
  const back = <Link to={{ page: "manage" }}>← All garments</Link>;
  if (stored === null || !form) return <section>{back}<p>No garment with id {id}.</p></section>;

  const parsed = parseGarmentForm(form, stored);
  const dirty = parsed.ok ? changedFields(stored, parsed.fields).length > 0 : true;

  async function save() {
    const r = parseGarmentForm(form!, stored!);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    setStatus("saving");
    try {
      await saveGarment(uid, id, r.fields);
      setForm(toForm(r.fields));
      setStatus("saved");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  const src = photoUrl(stored);

  async function replacePhoto() {
    if (!newPhoto || newPhoto.errors.length > 0) return;
    setPhotoStatus("Uploading…");
    try {
      await uploadGarmentPhoto(stored!.photo, newPhoto.file);
      await saveGarment(uid, id, { ...stored!, photoVersion: new Date().toISOString() }, "Photo replaced");
      setNewPhoto(null);
      setPickerKey((k) => k + 1);
      setPhotoStatus("Photo replaced.");
    } catch (e) {
      setPhotoStatus(`Replacing failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${stored!.item}” (${id})? This can't be undone in the app.`)) return;
    try {
      await deleteGarment(uid, id);
      navigate({ page: "manage" });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    }
  }
  const neverWorn = stats ? stats.lifetimeWears === 0 : stored.timesUsedInit === 0;

  return (
    <section className="edit">
      {back}
      <div className="edit-head">
        {src && <img src={src} alt="" />}
        <div>
          <h2>{stored.item}</h2>
          <p className="muted">
            <Link to={{ page: "garment", id }}>Public page</Link> · {id}
            {stats && <> · worn {stats.lifetimeWears} times · {stats.costPerWear == null ? "–" : formatEur2(stats.costPerWear)} per wear</>}
          </p>
        </div>
      </div>

      <form
        className="garment-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <GarmentFormFields form={form} errors={errors} onChange={(f) => { setForm(f); setStatus("idle"); }} />

        <div className="actions">
          <button type="submit" className="primary" disabled={!dirty || status === "saving"}>
            {status === "saving" ? "Saving…" : "Save"}
          </button>
          <button type="button" disabled={!dirty} onClick={() => { setForm(toForm(stored)); setErrors({}); }}>
            Discard changes
          </button>
          {status === "saved" && !dirty && <span className="ok">Saved. Public pages are updated.</span>}
          {status === "error" && <span className="error">Saving failed: {message}</span>}
        </div>
      </form>

      {wardrobe && <RotationSetting uid={uid} item={stored.item} category={stored.category} wardrobe={wardrobe} />}

      <h3>Photo</h3>
      <div className="field photo-replace">
        <PhotoPicker key={pickerKey} onChange={setNewPhoto} />
        <div className="row">
          <button type="button" disabled={!newPhoto || newPhoto.errors.length > 0} onClick={() => void replacePhoto()}>
            Replace photo
          </button>
          {photoStatus && <span className={photoStatus.startsWith("Replacing failed") ? "error" : "muted"}>{photoStatus}</span>}
        </div>
      </div>

      <h3>History</h3>
      {history === null ? (
        <p className="muted">Loading…</p>
      ) : history.length === 0 ? (
        <p className="muted">No changes made in the app yet.</p>
      ) : (
        <ul className="history">
          {history.map((h) => (
            <li key={h.id}>
              <span>{h.savedAt ? h.savedAt.toLocaleString("fi-FI") : "just now"}</span>
              {h.note ? (
                <span className="muted">{h.note}</span>
              ) : h.before ? (
                <>
                  <span className="muted">
                    {changedFields(h.before, h.after)
                      .map((k) => `${LABELS[k]}: ${show(h.before![k])} → ${show(h.after[k])}`)
                      .join("; ") || "no changes"}
                  </span>
                  <button type="button" onClick={() => { setForm(toForm(h.before!)); setStatus("idle"); }}>
                    Restore previous values
                  </button>
                </>
              ) : (
                <span className="muted">Created in the app</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3>Delete</h3>
      {neverWorn ? (
        <div className="row">
          <button type="button" className="danger" onClick={() => void remove()}>Delete this garment</button>
          <span className="muted">
            Only for garments added by mistake: it has never been worn. If it has a row in the Sheet, remove that
            too (the sync won't re-create it, but reports the row).
          </span>
          {deleteError && <span className="error">{deleteError}</span>}
        </div>
      ) : (
        <p className="muted">Garments that have been worn can't be deleted, since their wears are part of the history. Divest it instead.</p>
      )}
    </section>
  );
}

/** "Rotate as a series" (lib/rotation.ts): offered for a garment whose name ends in a number when other active
 *  garments share the name. Applies to the whole series at once (settings/app.rotationSeries). */
function RotationSetting({ uid, item, category, wardrobe }: { uid: string; item: string; category: string; wardrobe: Wardrobe }) {
  const keys = useRotationSeries(uid);
  const [error, setError] = useState("");
  const series = seriesOf({ item, category });
  const members = useMemo(() => {
    if (!series) return [];
    const today = todayIso();
    const active = wardrobe.garments.filter((g) => seriesOf(g)?.key === series.key && isActive(g, today));
    return rotationOrder(active, wearIndex(wardrobe.days));
  }, [series?.key, wardrobe]);
  if (!series || members.length < 2) return null;
  const on = keys.includes(series.key);
  return (
    <>
      <h3>Logging</h3>
      <label className="field checkbox-field">
        <span>Rotate as a series</span>
        <span className="row">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => {
              setError("");
              setRotationSeries(uid, series.key, e.target.checked).catch((err) => setError(err instanceof Error ? err.message : String(err)));
            }}
          />
          <small className="muted">
            On the Log page, the {members.length} active “{series.name}” garments show as one tile that logs the next in
            line: the fewest wears, then the lowest number{on && members[0] ? ` (now ${seriesOf(members[0])?.number})` : ""}.
          </small>
        </span>
      </label>
      {error && <p className="error">Not saved: {error}</p>}
    </>
  );
}

function show(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatFi(v);
  return String(v);
}
