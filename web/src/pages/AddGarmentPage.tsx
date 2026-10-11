// Add a garment (R-27 phase b, owner only): details + a standard PNG photo. The Photo id (= garment id)
// is the next free number in the category; the photo is stored as <id>.png like the existing ones.
// Since the cut-over (2026-10-09) new garments are logged in the app; no Sheet row is needed.
import { useMemo, useState } from "react";
import { GarmentFormFields } from "../components/GarmentFormFields";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { Link } from "../components/Link";
import { createGarment } from "../data/repo";
import { photoUrl, uploadGarmentPhoto } from "../firebase";
import { todayIso } from "../lib/dates";
import { nextPhotoId, parseGarmentForm, type FormErrors, type GarmentForm } from "../lib/garmentForm";
import type { Wardrobe } from "../lib/publicData";

const EMPTY: GarmentForm = {
  category: "",
  item: "",
  details: "",
  price: "",
  purchased: todayIso(),
  divested: "",
  timesUsedInit: "0",
  materials: "",
  weightG: "",
  detailsUnavailable: false,
  tags: [],
};

export function AddGarmentPage({ uid, wardrobe }: { uid: string; wardrobe: Wardrobe | null }) {
  const [form, setForm] = useState<GarmentForm>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [status, setStatus] = useState<"editing" | "saving" | "error">("editing");
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<{ id: string; item: string } | null>(null);

  const photoId = useMemo(
    () => (form.category && wardrobe ? nextPhotoId(form.category, wardrobe.garments.map((g) => g.id)) : ""),
    [form.category, wardrobe],
  );

  async function save() {
    const r = parseGarmentForm(form, { photo: photoId });
    const missingPhoto = !photo;
    if (!r.ok || missingPhoto || photo.errors.length > 0) {
      setErrors(r.ok ? {} : r.errors);
      if (missingPhoto) setMessage("Choose the garment's PNG photo.");
      return;
    }
    setErrors({});
    setMessage("");
    setStatus("saving");
    try {
      await uploadGarmentPhoto(photoId, photo!.file);
      await createGarment(uid, photoId, r.fields);
      setCreated({ id: photoId, item: r.fields.item });
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  if (!wardrobe) return <p>Loading…</p>;
  const back = <Link to={{ page: "manage" }}>← All garments</Link>;

  if (created) {
    return (
      <section className="edit">
        {back}
        <div className="edit-head">
          <img src={photoUrl({ photo: created.id }) ?? ""} alt="" />
          <div>
            <h2>Added: {created.item}</h2>
            <p className="ok">Saved with its photo. Public pages are updated.</p>
          </div>
        </div>
        <p>
          Photo id <code>{created.id}</code>. It's ready to be logged on the <Link to={{ page: "log" }}>Log</Link> page.
        </p>
        <p className="row">
          <Link to={{ page: "manage", id: created.id }}>Open the garment</Link>
          <a href="/manage/new" onClick={(e) => { e.preventDefault(); setForm(EMPTY); setPhoto(null); setPickerKey((k) => k + 1); setCreated(null); setStatus("editing"); }}>
            Add another
          </a>
        </p>
      </section>
    );
  }

  return (
    <section className="edit">
      {back}
      <h2>Add a garment</h2>
      <form
        className="garment-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="field">
          <span>Photo</span>
          <PhotoPicker key={pickerKey} onChange={setPhoto} invalid={!!message && !photo} />
        </div>
        <label className="field">
          <span>Photo id</span>
          <code className="photo-id">{photoId || "Choose a category first"}</code>
          <small className="muted">Next free number in the category; also the garment's id.</small>
        </label>
        <GarmentFormFields form={form} errors={errors} onChange={setForm} />

        <div className="actions">
          <button type="submit" className="primary" disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Add garment"}
          </button>
          {message && <span className="error">{status === "error" ? `Saving failed: ${message}` : message}</span>}
        </div>
      </form>
    </section>
  );
}
