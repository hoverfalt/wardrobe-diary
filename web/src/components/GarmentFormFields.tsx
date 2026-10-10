// The garment form fields (Sheet columns A–K except Photo), shared by the edit and add pages.
import type { ReactNode } from "react";
import { CATEGORY_ORDER } from "../lib/categories";
import { todayIso } from "../lib/dates";
import type { FormErrors, GarmentForm } from "../lib/garmentForm";

export const LABELS: Record<keyof GarmentForm | "photo" | "photoVersion", string> = {
  category: "Category",
  item: "Name",
  details: "Details",
  photo: "Photo",
  photoVersion: "Photo version",
  price: "Price (€)",
  purchased: "Purchased",
  divested: "Divested",
  timesUsedInit: "Times used before tracking",
  materials: "Materials",
  weightG: "Weight (g)",
};

export function GarmentFormFields({
  form,
  errors,
  onChange,
  categoryLocked = false,
}: {
  form: GarmentForm;
  errors: FormErrors;
  onChange: (form: GarmentForm) => void;
  /** The add page locks the category once a photo id has been reserved for it. */
  categoryLocked?: boolean;
}) {
  const set = (k: keyof GarmentForm) => (e: { target: { value: string } }) => onChange({ ...form, [k]: e.target.value });
  const field = (k: keyof GarmentForm, input: ReactNode, hint?: string) => (
    <label className={errors[k] ? "field invalid" : "field"}>
      <span>{LABELS[k]}</span>
      {input}
      {errors[k] ? <small className="error">{errors[k]}</small> : hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
  return (
    <>
      {field("category",
        <select value={form.category} onChange={set("category")} disabled={categoryLocked}>
          {!CATEGORY_ORDER.includes(form.category) && <option value={form.category}>{form.category || "Choose…"}</option>}
          {CATEGORY_ORDER.map((c) => <option key={c}>{c}</option>)}
        </select>)}
      {field("item", <input value={form.item} onChange={set("item")} />)}
      {field("details", <input value={form.details} onChange={set("details")} />, "Size, model code, etc.")}
      {field("price", <input inputMode="decimal" value={form.price} onChange={set("price")} />)}
      {field("purchased", <input type="date" value={form.purchased} onChange={set("purchased")} />)}
      {field("divested",
        <div className="row">
          <input type="date" value={form.divested} onChange={set("divested")} />
          {form.divested ? (
            <button type="button" onClick={() => onChange({ ...form, divested: "" })}>Undo divest</button>
          ) : (
            <button type="button" onClick={() => onChange({ ...form, divested: todayIso() })}>Divest today</button>
          )}
        </div>,
        "Empty = still active. The divest day still counts as owned.")}
      {field("timesUsedInit", <input inputMode="numeric" value={form.timesUsedInit} onChange={set("timesUsedInit")} />, "Wears before tracking began on 1.1.2018.")}
      {field("materials", <input value={form.materials} onChange={set("materials")} />)}
      {field("weightG", <input inputMode="decimal" value={form.weightG} onChange={set("weightG")} />)}
    </>
  );
}
