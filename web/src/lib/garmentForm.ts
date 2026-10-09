// Garment edit form (R-27): form values are strings as typed; parseGarmentForm validates and normalises
// them into the stored fields (Sheet columns A–K). Photo is not editable in phase (a).
import type { Garment } from "../types";
import { CATEGORY_ORDER } from "./categories";

export type GarmentFields = Omit<Garment, "id">;

export interface GarmentForm {
  category: string;
  item: string;
  details: string;
  price: string;
  purchased: string;
  divested: string;
  timesUsedInit: string;
  materials: string;
  weightG: string;
}

export type FormErrors = Partial<Record<keyof GarmentForm, string>>;

const num = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

export function toForm(g: GarmentFields): GarmentForm {
  return {
    category: g.category,
    item: g.item,
    details: g.details,
    price: num(g.price),
    purchased: g.purchased ?? "",
    divested: g.divested ?? "",
    timesUsedInit: String(g.timesUsedInit),
    materials: g.materials,
    weightG: num(g.weightG),
  };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (v: string) => ISO.test(v) && !Number.isNaN(Date.parse(v));

/** "49,90" or "49.90" → 49.9; "" → null; anything else → NaN. */
function parseNumber(v: string): number | null {
  const t = v.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export function parseGarmentForm(
  form: GarmentForm,
  photo: string,
): { ok: true; fields: GarmentFields } | { ok: false; errors: FormErrors } {
  const errors: FormErrors = {};
  const item = form.item.trim();
  if (!item) errors.item = "Name is required.";
  if (!CATEGORY_ORDER.includes(form.category)) errors.category = "Choose a category.";

  const price = parseNumber(form.price);
  if (Number.isNaN(price)) errors.price = "Enter a price in euros, e.g. 49,90.";

  const purchased = form.purchased.trim() || null;
  const divested = form.divested.trim() || null;
  if (purchased && !isIsoDate(purchased)) errors.purchased = "Enter a valid date.";
  if (divested && !isIsoDate(divested)) errors.divested = "Enter a valid date.";
  if (purchased && divested && !errors.purchased && !errors.divested && divested < purchased)
    errors.divested = "Divested can't be before purchased.";

  const init = parseNumber(form.timesUsedInit);
  if (init != null && (Number.isNaN(init) || !Number.isInteger(init)))
    errors.timesUsedInit = "Enter a whole number (0 if none).";

  const weight = parseNumber(form.weightG);
  if (Number.isNaN(weight)) errors.weightG = "Enter a weight in grams, or leave empty.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    fields: {
      category: form.category,
      item,
      details: form.details.trim(),
      photo,
      price: price == null ? null : Math.round(price * 100) / 100,
      purchased,
      divested,
      timesUsedInit: init ?? 0,
      materials: form.materials.trim(),
      weightG: weight,
    },
  };
}

/** Field names that differ between two versions (for the history list). */
export function changedFields(before: GarmentFields, after: GarmentFields): (keyof GarmentFields)[] {
  return (Object.keys(after) as (keyof GarmentFields)[]).filter((k) => before[k] !== after[k]);
}
