// Add a garment (R-27 phase b, owner only): details + a standard PNG photo. The Photo id (= garment id)
// is the next free number in the category; the photo is stored as <id>.png like the existing ones.
import { useEffect, useMemo, useState } from "react";
import { GarmentFormFields } from "../components/GarmentFormFields";
import { Link } from "../components/Link";
import { createGarment } from "../data/repo";
import { uploadGarmentPhoto } from "../firebase";
import { todayIso } from "../lib/dates";
import { checkPhoto, nextPhotoId, parseGarmentForm, PHOTO_SIZE, type FormErrors, type GarmentForm } from "../lib/garmentForm";
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
};

export function AddGarmentPage({ uid, wardrobe }: { uid: string; wardrobe: Wardrobe | null }) {
  const [form, setForm] = useState<GarmentForm>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"editing" | "saving" | "error">("editing");
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<{ id: string; item: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const photoId = useMemo(
    () => (form.category && wardrobe ? nextPhotoId(form.category, wardrobe.garments.map((g) => g.id)) : ""),
    [form.category, wardrobe],
  );

  // Preview and pixel size of the chosen file.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setDims(null);
    const img = new Image();
    img.onload = () => setDims({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const photoCheck = file ? checkPhoto(file, dims) : null;

  async function save() {
    const r = parseGarmentForm(form, photoId);
    const missingPhoto = !file;
    if (!r.ok || missingPhoto || (photoCheck && photoCheck.errors.length > 0)) {
      setErrors(r.ok ? {} : r.errors);
      if (missingPhoto) setMessage("Choose the garment's PNG photo.");
      return;
    }
    setErrors({});
    setMessage("");
    setStatus("saving");
    try {
      await uploadGarmentPhoto(photoId, file!);
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
          {preview && <img src={preview} alt="" />}
          <div>
            <h2>Added: {created.item}</h2>
            <p className="ok">Saved with its photo. Public pages are updated.</p>
          </div>
        </div>
        <div className="notice">
          <p>
            <strong>To log its wears in the Google Sheet</strong>, add a row there with the Category, the Item
            name and this Photo id:
          </p>
          <p className="row">
            <code>{created.id}</code>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(created.id).then(() => setCopied(true))}
            >
              {copied ? "Copied" : "Copy Photo id"}
            </button>
          </p>
          <p className="muted">The sync matches the row by Photo id; the other columns in the Sheet are not read.</p>
        </div>
        <p className="row">
          <Link to={{ page: "manage", id: created.id }}>Open the garment</Link>
          <a href="/manage/new" onClick={(e) => { e.preventDefault(); setForm(EMPTY); setFile(null); setPreview(null); setCreated(null); setCopied(false); setStatus("editing"); }}>
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
        <label className={message && !file ? "field invalid" : "field"}>
          <span>Photo</span>
          <div className="photo-pick">
            <span className="photo-preview">{preview ? <img src={preview} alt="" /> : "PNG"}</span>
            <input type="file" accept="image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {photoCheck?.errors.map((m) => <small key={m} className="error">{m}</small>)}
          {photoCheck?.warnings.map((m) => <small key={m} className="muted">{m}</small>)}
          {!file && <small className="muted">The standard garment photo: {PHOTO_SIZE} × {PHOTO_SIZE} px PNG.</small>}
        </label>
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
