// Garment management (R-27, owner only): list of all garments, active and divested, with filters.
import { useMemo, useState } from "react";
import { formatEur2 } from "../components/CategoryCharts";
import { Link } from "../components/Link";
import { photoUrl } from "../firebase";
import { CATEGORY_ORDER, compareCategories } from "../lib/categories";
import { formatFi, todayIso } from "../lib/dates";
import { updateGarments } from "../data/repo";
import { applyBulk, type BulkAction } from "../lib/garmentForm";
import { materialsIssue, type MaterialsIssue } from "../lib/materials";
import { itemListing, TRACKING_START } from "../lib/metrics";
import type { Wardrobe } from "../lib/publicData";
import type { Garment } from "../types";

type Status = "all" | "active" | "divested";
type Review = "" | MaterialsIssue | "no-weight";

const REVIEW_LABELS: Record<Exclude<Review, "">, string> = {
  unreadable: "Materials: words not understood",
  estimated: "Materials: shares estimated (no % or not summing to 100)",
  missing: "Materials: missing or NA",
  "no-weight": "Weight: missing",
};

function reviewReason(g: Garment, review: Review): boolean {
  if (review === "") return true;
  if (g.detailsUnavailable) return false; // marked: details can't be completed
  if (review === "no-weight") return !g.weightG;
  return materialsIssue(g.materials) === review;
}

export function ManagePage({ uid, wardrobe }: { uid: string; wardrobe: Wardrobe | null }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [review, setReview] = useState<Review>("");

  const rows = useMemo(() => {
    if (!wardrobe) return [];
    const all = itemListing(wardrobe.garments, wardrobe.days, { from: TRACKING_START, to: todayIso() });
    const listed = new Set(all.map((r) => r.garment.id));
    // Garments never owned within tracking (e.g. no dates) still need to be editable.
    const others = wardrobe.garments.filter((g) => !listed.has(g.id));
    return [
      ...all.map((r) => ({ garment: r.garment, worn: r.lifetimeWears, active: r.active })),
      ...others.map((g) => ({ garment: g, worn: 0, active: !g.divested })),
    ].sort(
      (a, b) =>
        compareCategories(a.garment.category, b.garment.category) ||
        Number(b.active) - Number(a.active) ||
        a.garment.item.localeCompare(b.garment.item),
    );
  }, [wardrobe]);

  const q = search.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!category || r.garment.category === category) &&
      (status === "all" || (status === "active") === r.active) &&
      reviewReason(r.garment, review) &&
      (!q || `${r.garment.item} ${r.garment.details} ${r.garment.materials} ${r.garment.id}`.toLowerCase().includes(q)),
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.garment.id));
  const selectShown = () => {
    const next = new Set(selected);
    for (const r of shown) {
      if (allShownSelected) next.delete(r.garment.id);
      else next.add(r.garment.id);
    }
    setSelected(next);
  };

  if (!wardrobe) return <p>Loading…</p>;
  return (
    <section>
      <div className="manage-head">
        <h2>Manage garments</h2>
        <Link className="button primary" to={{ page: "manage", id: "new" }}>+ Add garment</Link>
      </div>
      <div className="filters">
        <input type="search" placeholder="Search name, details, materials, photo id" value={search}
          onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORY_ORDER.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Status">
          <option value="all">Active and divested</option>
          <option value="active">Active</option>
          <option value="divested">Divested</option>
        </select>
        <select value={review} onChange={(e) => setReview(e.target.value as Review)} aria-label="Review">
          <option value="">No review filter</option>
          {(Object.keys(REVIEW_LABELS) as Exclude<Review, "">[]).map((k) => (
            <option key={k} value={k}>
              Review – {REVIEW_LABELS[k]} ({rows.filter((r) => reviewReason(r.garment, k)).length})
            </option>
          ))}
        </select>
        <span className="muted">{shown.length} of {rows.length}</span>
      </div>
      {selected.size > 0 && (
        <BulkBar
          uid={uid}
          garments={wardrobe.garments.filter((g) => selected.has(g.id))}
          onDone={() => setSelected(new Set())}
        />
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="check">
                <input type="checkbox" checked={allShownSelected} onChange={selectShown} aria-label="Select all shown" />
              </th>
              <th aria-label="Image" />
              <th>Item</th>
              <th>Category</th>
              <th className="num">Price</th>
              <th>Purchased</th>
              <th>Divested</th>
              <th className="num">Times worn</th>
              {review && <th>{review === "no-weight" ? "Weight" : "Materials"}</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ garment: g, worn, active }) => {
              const src = photoUrl(g);
              return (
                <tr key={g.id} className={active ? undefined : "divested"}>
                  <td className="check">
                    <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggle(g.id)} aria-label={`Select ${g.item}`} />
                  </td>
                  <td className="img">{src && <img className="category-image" src={src} alt="" loading="lazy" />}</td>
                  <td><Link to={{ page: "manage", id: g.id }}>{g.item}</Link></td>
                  <td>{g.category}</td>
                  <td className="num">{g.price == null ? "–" : formatEur2(g.price)}</td>
                  <td>{formatFi(g.purchased)}</td>
                  <td>{formatFi(g.divested)}</td>
                  <td className="num">{worn}</td>
                  {review && <td className="review-cell">{review === "no-weight" ? "–" : g.materials || "–"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ActionType = BulkAction["type"] | "available";

/** Bulk changes for the selected garments: divest on a date, mark active again, or set the category.
 *  Garments a change can't apply to are listed and left out. */
function BulkBar({ uid, garments, onDone }: { uid: string; garments: Garment[]; onDone: () => void }) {
  const [type, setType] = useState<ActionType>("divest");
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState(CATEGORY_ORDER[0]);
  const [status, setStatus] = useState("");
  const action: BulkAction =
    type === "divest" ? { type, date }
    : type === "category" ? { type, category }
    : type === "unavailable" ? { type, value: true }
    : type === "available" ? { type: "unavailable", value: false }
    : { type };
  const results = garments.map((g) => ({ g, r: applyBulk(g, action) }));
  const ok = results.filter((x) => typeof x.r !== "string").map((x) => x.g);
  const skipped = results.filter((x) => typeof x.r === "string");

  async function apply() {
    setStatus("Saving…");
    try {
      await updateGarments(
        uid,
        ok.map((g) => ({
          id: g.id,
          update: (current) => {
            const r = applyBulk(current, action);
            if (typeof r === "string") throw new Error(`${g.item}: ${r}`);
            return r;
          },
        })),
      );
      setStatus("");
      onDone();
    } catch (e) {
      setStatus(`Saving failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="bulk-bar">
      <strong>{garments.length} selected</strong>
      <select value={type} onChange={(e) => setType(e.target.value as ActionType)} aria-label="Bulk change">
        <option value="divest">Divest on</option>
        <option value="activate">Mark active again</option>
        <option value="category">Set category to</option>
        <option value="unavailable">Mark: details can't be completed (divested only)</option>
        <option value="available">Unmark: details can be completed</option>
      </select>
      {type === "divest" && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Divest date" />}
      {type === "category" && (
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          {CATEGORY_ORDER.map((c) => <option key={c}>{c}</option>)}
        </select>
      )}
      <button type="button" className="primary" disabled={ok.length === 0 || status === "Saving…"} onClick={() => void apply()}>
        Apply to {ok.length}
      </button>
      <button type="button" onClick={onDone}>Clear selection</button>
      {status && <span className={status.startsWith("Saving failed") ? "error" : "muted"}>{status}</span>}
      {skipped.length > 0 && (
        <small className="muted">
          Left out: {skipped.map((x) => `${x.g.item} (${x.r})`).join("; ")}
        </small>
      )}
    </div>
  );
}
