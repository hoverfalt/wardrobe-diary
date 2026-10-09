// One page per category (live site: jackets.html etc.): item listing and charts per item.
import { useMemo, type ReactNode } from "react";
import { formatEur2 } from "../components/CategoryCharts";
import { TimesWornChart } from "../components/TimesWornChart";
import { categoryImageUrl, photoUrl } from "../firebase";
import { categoryFromSlug } from "../lib/categories";
import { barMax, barStyle } from "../lib/dataBars";
import { itemListing, type DateRange, type ItemRow } from "../lib/metrics";
import type { Wardrobe } from "../lib/publicData";
import { navigate } from "../lib/route";

// Columns with data bars, as on the live site (bar maximum = the column's largest value).
const COLUMNS: { title: string; value: (r: ItemRow) => number | null; format: (v: number | null) => string; bar: string }[] = [
  { title: "Price", value: (r) => r.garment.price, format: (v) => (v == null ? "–" : formatEur2(v)), bar: "var(--bar-grey)" },
  { title: "Times worn", value: (r) => r.timesWorn, format: (v) => String(v ?? "–"), bar: "var(--bar-blue)" },
  { title: "Cost per wear", value: (r) => r.costPerWear, format: (v) => (v == null ? "–" : formatEur2(v)), bar: "var(--bar-red)" },
  { title: "Wears per month", value: (r) => r.wearsPerMonth, format: (v) => (v == null ? "–" : v.toFixed(1).replace(".", ",")), bar: "var(--bar-green)" },
];

export function CategoryPage({
  slug,
  wardrobe,
  range,
  rangeControl,
}: {
  slug: string;
  wardrobe: Wardrobe | null;
  range: DateRange;
  rangeControl: ReactNode;
}) {
  const category = categoryFromSlug(slug);
  const rows = useMemo(() => {
    if (!wardrobe || !category) return [];
    const garments = wardrobe.garments.filter((g) => g.category === category);
    // As on the live site: active items first, then by times worn.
    return itemListing(garments, wardrobe.days, range).sort(
      (a, b) => Number(b.active) - Number(a.active) || b.timesWorn - a.timesWorn,
    );
  }, [wardrobe, category, range]);
  const maxima = useMemo(() => COLUMNS.map((c) => barMax(rows.map(c.value))), [rows]);

  const back = (
    <a href="/" onClick={(e) => { e.preventDefault(); navigate({ page: "dashboard" }); }}>← Dashboard</a>
  );
  if (!category) return <section>{back}<p>Unknown category.</p></section>;
  if (!wardrobe) return <p>Loading…</p>;
  const img = categoryImageUrl(category);

  return (
    <section>
      {back}
      <h2 className="category-title">
        {img && <img src={img} alt="" />}
        {category}
      </h2>
      {rangeControl}

      <h3>Item listing</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th aria-label="Image" />
              <th>Item</th>
              {COLUMNS.map((c) => <th key={c.title} className="num">{c.title}</th>)}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const src = photoUrl(r.garment.photo);
              return (
                <tr key={r.garment.id} className={r.active ? undefined : "divested"}>
                  <td className="img">{src && <img className="category-image" src={src} alt="" loading="lazy" />}</td>
                  <td>{r.garment.item}</td>
                  {COLUMNS.map((c, i) => (
                    <td key={c.title} className="num" style={barStyle(c.value(r), maxima[i], c.bar)}>
                      {c.format(c.value(r))}
                    </td>
                  ))}
                  <td>{r.active ? "Active" : "Divested"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Times worn and wears per month count the chosen time span; cost per wear is always over the item's
        whole ownership.
      </p>
      {rangeControl}

      <h3>Times worn</h3>
      <p className="muted">
        Items by status (green divested, gray active) and in purchase order (newer higher). Hover an item for
        details.
      </p>
      <TimesWornChart rows={rows} />
      {rangeControl}
    </section>
  );
}
