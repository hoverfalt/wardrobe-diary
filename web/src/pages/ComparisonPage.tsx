// Comparison items (R-26, owner only, /manage/comparison): other spending drawn next to the clothing
// categories in the Dashboard's monthly cost chart. Monthly cost and use frequency are entered; yearly cost
// and cost per use are derived. Stored in settings/comparison and copied to the public data on every save.
import { useState } from "react";
import { formatEur2 } from "../components/CategoryCharts";
import { Link } from "../components/Link";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { updateComparison, useComparison } from "../data/repo";
import { comparisonPhotoUrl, uploadComparisonPhoto } from "../firebase";
import {
  comparisonId,
  comparisonPhotoName,
  comparisonTypes,
  costPerUse,
  formatFrequency,
  parseFrequency,
  parseNumber,
  yearlyCost,
  type ComparisonItem,
} from "../lib/comparison";

interface Form {
  type: string;
  item: string;
  details: string;
  monthlyCost: string;
  useFrequency: string;
}

const EMPTY: Form = { type: "", item: "", details: "", monthlyCost: "", useFrequency: "" };
const toForm = (c: ComparisonItem): Form => ({
  type: c.type,
  item: c.item,
  details: c.details,
  monthlyCost: String(Math.round(c.monthlyCost * 100) / 100).replace(".", ","),
  useFrequency: formatFrequency(c.useFrequency),
});
const pct = (v: number) => `${(v * 100).toFixed(0)} %`;

export function ComparisonPage({ uid }: { uid: string }) {
  const items = useComparison(uid);
  /** Item being edited: its id, "new", or null when no form is open. */
  const [editing, setEditing] = useState<string | null>(null);

  if (!items) return <p>Loading…</p>;
  return (
    <section>
      <Link to={{ page: "manage" }}>← Manage garments</Link>
      <div className="manage-head">
        <h2>Comparison</h2>
        {editing === null && <button className="primary" onClick={() => setEditing("new")}>+ Add item</button>}
      </div>
      <p className="muted">
        Other spending shown in grey next to the clothing categories in the Dashboard's “Monthly cost compared with
        other spending” chart. Enter the monthly cost and how often it is used; yearly cost and cost per use are
        calculated (cost per use = monthly cost / (30,5 × use frequency)).
      </p>
      {editing !== null && (
        <ComparisonForm
          key={editing}
          uid={uid}
          items={items}
          current={items.find((c) => c.id === editing) ?? null}
          onClose={() => setEditing(null)}
        />
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th aria-label="Photo" />
              <th>Item</th>
              <th>Type</th>
              <th className="num">Monthly cost</th>
              <th className="num">Use frequency</th>
              <th className="num">Yearly cost</th>
              <th className="num">Cost per use</th>
              <th aria-label="Edit" />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const src = comparisonPhotoUrl(c);
              const perUse = costPerUse(c);
              return (
                <tr key={c.id}>
                  <td className="img">{src && <img className="category-image" src={src} alt="" />}</td>
                  <td>
                    {c.item}
                    {c.details && <div className="muted">{c.details}</div>}
                  </td>
                  <td>{c.type}</td>
                  <td className="num">{formatEur2(c.monthlyCost)}</td>
                  <td className="num">{pct(c.useFrequency)}</td>
                  <td className="num">{formatEur2(yearlyCost(c))}</td>
                  <td className="num">{perUse == null ? "–" : formatEur2(perUse)}</td>
                  <td><button onClick={() => setEditing(c.id)} disabled={editing !== null}>Edit</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {items.length === 0 && <p className="muted">No comparison items yet.</p>}
    </section>
  );
}

function ComparisonForm({ uid, items, current, onClose }: { uid: string; items: ComparisonItem[]; current: ComparisonItem | null; onClose: () => void }) {
  const [form, setForm] = useState<Form>(current ? toForm(current) : EMPTY);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const monthly = parseNumber(form.monthlyCost);
  const freq = parseFrequency(form.useFrequency);
  const errors = {
    item: form.item.trim() === "",
    monthlyCost: monthly == null || monthly < 0,
    useFrequency: freq == null,
    photo: !!photo?.errors.length,
  };
  const invalid = Object.values(errors).some(Boolean);
  const preview = !errors.monthlyCost && !errors.useFrequency ? { monthlyCost: monthly!, useFrequency: freq! } : null;
  const perUse = preview && costPerUse(preview);
  const currentSrc = current && comparisonPhotoUrl(current);

  async function save() {
    if (invalid) return setMessage("Fill in the marked fields.");
    setBusy(true);
    setMessage("");
    try {
      const id = current?.id ?? comparisonId(form.item, items.map((c) => c.id));
      // Like garments: the photo name is set once a photo is uploaded, and kept when it is replaced.
      let photoName = current?.photo ?? "";
      let photoVersion = current?.photoVersion ?? null;
      if (photo) {
        photoName ||= comparisonPhotoName(form.item);
        await uploadComparisonPhoto(photoName, photo.file);
        photoVersion = new Date().toISOString();
      }
      const next: ComparisonItem = {
        id,
        type: form.type.trim(),
        item: form.item.trim(),
        details: form.details.trim(),
        photo: photoName,
        photoVersion,
        monthlyCost: Math.round(monthly! * 10000) / 10000,
        useFrequency: freq!,
      };
      await updateComparison(uid, (stored) =>
        stored.some((c) => c.id === id) ? stored.map((c) => (c.id === id ? next : c)) : [...stored, next],
      );
      onClose();
    } catch (e) {
      setMessage(`Not saved: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
    }
  }

  async function remove() {
    if (!current || !confirm(`Delete ${current.item} from the comparison?`)) return;
    setBusy(true);
    try {
      await updateComparison(uid, (stored) => stored.filter((c) => c.id !== current.id));
      onClose();
    } catch (e) {
      setMessage(`Not deleted: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
    }
  }

  return (
    <div className="comparison-form">
      <h3>{current ? `Edit ${current.item}` : "Add item"}</h3>
      <div className="garment-form">
        <label className={errors.item ? "field invalid" : "field"}>
          <span>Item</span>
          <input value={form.item} onChange={set("item")} />
        </label>
        <label className="field">
          <span>Type</span>
          <input value={form.type} onChange={set("type")} list="comparison-types" placeholder="e.g. Content" />
          <datalist id="comparison-types">
            {comparisonTypes(items).map((t) => <option key={t} value={t} />)}
          </datalist>
        </label>
        <label className="field">
          <span>Details</span>
          <input value={form.details} onChange={set("details")} />
        </label>
        <label className={errors.monthlyCost ? "field invalid" : "field"}>
          <span>Monthly cost (€)</span>
          <input value={form.monthlyCost} onChange={set("monthlyCost")} inputMode="decimal" placeholder="e.g. 59,70" />
        </label>
        <label className={errors.useFrequency ? "field invalid" : "field"}>
          <span>Use frequency (% of days, or a fraction like 6/7)</span>
          <input value={form.useFrequency} onChange={set("useFrequency")} placeholder="e.g. 85,7 or 6/7" />
          {freq != null && form.useFrequency.includes("/") && <small className="muted">= {formatFrequency(freq)} %</small>}
        </label>
        <div className="field">
          <span>Yearly cost · cost per use (calculated)</span>
          <strong>{preview ? `${formatEur2(yearlyCost(preview))} · ${perUse == null ? "–" : formatEur2(perUse)}` : "–"}</strong>
        </div>
        <div className="field">
          <span>Photo{currentSrc ? " (replace)" : ""}</span>
          {currentSrc && !photo && <img className="category-image" src={currentSrc} alt="" />}
          <PhotoPicker onChange={setPhoto} invalid={errors.photo} />
        </div>
      </div>
      <div className="filters">
        <button className="primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button onClick={onClose} disabled={busy}>Cancel</button>
        {current && <button onClick={remove} disabled={busy}>Delete</button>}
        {message && <span className="error">{message}</span>}
      </div>
    </div>
  );
}
