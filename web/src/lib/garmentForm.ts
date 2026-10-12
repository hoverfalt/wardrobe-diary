// Garment edit form (R-27): form values are strings as typed; parseGarmentForm validates and normalises
// them into the stored fields (Sheet columns A–K). Photo is not editable in phase (a).
import type { Garment } from "../types";
import { CATEGORY_ORDER } from "./categories";
import { tagsFromName, TAG_IDS, type Tag } from "./tags";

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
  /** Only offered for divested garments. */
  detailsUnavailable: boolean;
  tags: string[];
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
    detailsUnavailable: !!g.detailsUnavailable,
    tags: g.tags ?? [],
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
  base: { photo: string; photoVersion?: string | null },
): { ok: true; fields: GarmentFields } | { ok: false; errors: FormErrors } {
  const errors: FormErrors = {};
  // "(SH)" or "(Hanko)" typed in a name becomes the tag.
  const fromName = tagsFromName(form.item.trim());
  const item = fromName.item;
  const formTags = [...form.tags, ...fromName.tags.filter((t) => !form.tags.includes(t))];
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
      photo: base.photo,
      ...(base.photoVersion ? { photoVersion: base.photoVersion } : {}),
      price: price == null ? null : Math.round(price * 100) / 100,
      purchased,
      divested,
      timesUsedInit: init ?? 0,
      materials: form.materials.trim(),
      weightG: weight,
      // Meaningful only for divested garments; cleared when the garment is active again.
      ...(form.detailsUnavailable && divested ? { detailsUnavailable: true } : {}),
      ...(formTags.length ? { tags: TAG_IDS.filter((t) => formTags.includes(t)) } : {}),
    },
  };
}

/** Field names that differ between two versions (for the history list; the photo version is shown
 *  as the "Photo replaced" note instead). */
export function changedFields(before: GarmentFields, after: GarmentFields): (keyof GarmentFields)[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)] as (keyof GarmentFields)[]);
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return [...keys].filter((k) => k !== "photoVersion" && !same(before[k], after[k]));
}

/** Photo id prefix of a category, as in the Sheet: "T-shirts and tanks" → "T-shirts_and_tanks". */
export function photoPrefix(category: string): string {
  return category.replaceAll(" ", "_");
}

/** The next free Photo id in a category: one above the highest number in use, three digits
 *  ("Jackets_and_hoodies-035"). Garment ids are their Photo ids. */
export function nextPhotoId(category: string, existingIds: string[]): string {
  const prefix = `${photoPrefix(category)}-`;
  const used = existingIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((n) => Number.isInteger(n));
  return `${prefix}${String(Math.max(0, ...used) + 1).padStart(3, "0")}`;
}

/** The standard garment photo: a 228 × 228 PNG (as all existing photos are). */
export const PHOTO_SIZE = 228;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // also enforced by storage.rules

/** Problems that block an upload, and warnings that don't. */
export function checkPhoto(file: { type: string; size: number }, dims: { width: number; height: number } | null) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (file.type !== "image/png") errors.push("The photo must be a PNG file.");
  if (file.size >= PHOTO_MAX_BYTES) errors.push("The photo must be smaller than 5 MB.");
  if (dims && (dims.width !== PHOTO_SIZE || dims.height !== PHOTO_SIZE))
    warnings.push(
      `The photo is ${dims.width} × ${dims.height} px; the standard is ${PHOTO_SIZE} × ${PHOTO_SIZE}. It will be scaled${dims.width !== dims.height ? " and cropped to a circle" : ""}.`,
    );
  return { errors, warnings };
}

export type BulkAction =
  | { type: "divest"; date: string }
  | { type: "activate" }
  | { type: "category"; category: string }
  | { type: "unavailable"; value: boolean }
  | { type: "tag"; tag: Tag; value: boolean };

/** One bulk change applied to one garment: the new fields, or why it can't be applied to this one. */
export function applyBulk(g: GarmentFields, action: BulkAction): GarmentFields | string {
  switch (action.type) {
    case "divest":
      if (!isIsoDate(action.date)) return "Enter a valid date.";
      if (g.purchased && action.date < g.purchased) return `purchased ${g.purchased}, after the divest date`;
      return { ...g, divested: action.date };
    case "activate": {
      const { detailsUnavailable: _, ...rest } = g;
      return { ...rest, divested: null };
    }
    case "tag": {
      const rest = (g.tags ?? []).filter((t) => t !== action.tag);
      const tags = action.value ? TAG_IDS.filter((t) => t === action.tag || rest.includes(t)) : rest;
      const { tags: _, ...without } = g;
      return tags.length ? { ...without, tags } : without;
    }
    case "unavailable": {
      if (!g.divested) return "still active";
      const { detailsUnavailable: _, ...rest } = g;
      return action.value ? { ...rest, detailsUnavailable: true } : rest;
    }
    case "category":
      if (!CATEGORY_ORDER.includes(action.category)) return "Choose a category.";
      return { ...g, category: action.category };
  }
}
