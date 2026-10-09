// Garment management (R-27, owner only): list of all garments, active and divested, with filters.
import { useMemo, useState } from "react";
import { formatEur2 } from "../components/CategoryCharts";
import { Link } from "../components/Link";
import { photoUrl } from "../firebase";
import { CATEGORY_ORDER, compareCategories } from "../lib/categories";
import { formatFi, todayIso } from "../lib/dates";
import { itemListing, TRACKING_START } from "../lib/metrics";
import type { Wardrobe } from "../lib/publicData";

type Status = "all" | "active" | "divested";

export function ManagePage({ wardrobe }: { wardrobe: Wardrobe | null }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<Status>("all");

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
      (!q || `${r.garment.item} ${r.garment.details} ${r.garment.materials} ${r.garment.id}`.toLowerCase().includes(q)),
  );

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
        <span className="muted">{shown.length} of {rows.length}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th aria-label="Image" />
              <th>Item</th>
              <th>Category</th>
              <th className="num">Price</th>
              <th>Purchased</th>
              <th>Divested</th>
              <th className="num">Times worn</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ garment: g, worn, active }) => {
              const src = photoUrl(g.photo);
              return (
                <tr key={g.id} className={active ? undefined : "divested"}>
                  <td className="img">{src && <img className="category-image" src={src} alt="" loading="lazy" />}</td>
                  <td><Link to={{ page: "manage", id: g.id }}>{g.item}</Link></td>
                  <td>{g.category}</td>
                  <td className="num">{g.price == null ? "–" : formatEur2(g.price)}</td>
                  <td>{formatFi(g.purchased)}</td>
                  <td>{formatFi(g.divested)}</td>
                  <td className="num">{worn}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
