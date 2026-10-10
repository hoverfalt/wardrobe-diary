// One page per category (live site: jackets.html etc.): item listing and charts per item.
import { useMemo, type ReactNode } from "react";
import { formatEur2 } from "../components/CategoryCharts";
import { CostVsFrequencyAnimation, TimesWornAnimation } from "../components/CategoryAnimations";
import { DailyCostChart } from "../components/DailyCostCharts";
import { CostVsFrequencyChart, CostVsWearsChart } from "../components/ItemCharts";
import { TimesWornChart } from "../components/TimesWornChart";
import { categoryImageUrl, photoUrl } from "../firebase";
import { categoryFromSlug } from "../lib/categories";
import { barMax, barStyle } from "../lib/dataBars";
import { itemListing, type DateRange, type ItemRow } from "../lib/metrics";
import type { Wardrobe } from "../lib/publicData";
import { navigate } from "../lib/route";
import { Link } from "../components/Link";

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
  canEdit = false,
}: {
  slug: string;
  /** Signed in as the owner: show an Edit link per item. */
  canEdit?: boolean;
  wardrobe: Wardrobe | null;
  range: DateRange;
  rangeControl: ReactNode;
}) {
  const category = categoryFromSlug(slug);
  const garments = useMemo(
    () => (wardrobe && category ? wardrobe.garments.filter((g) => g.category === category) : []),
    [wardrobe, category],
  );
  const rows = useMemo(() => {
    if (!wardrobe || !category) return [];
    // As on the live site: active items first, then by times worn.
    return itemListing(garments, wardrobe.days, range).sort(
      (a, b) => Number(b.active) - Number(a.active) || b.timesWorn - a.timesWorn,
    );
  }, [wardrobe, category, garments, range]);
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
              const src = photoUrl(r.garment);
              return (
                <tr key={r.garment.id} className={r.active ? undefined : "divested"}>
                  <td className="img">{src && <img className="category-image" src={src} alt="" loading="lazy" />}</td>
                  <td>
                    {r.garment.item}
                    {canEdit && <> <Link className="edit-link" to={{ page: "manage", id: r.garment.id }}>Edit</Link></>}
                  </td>
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

      <h3>Cost per wear and times worn</h3>
      <p className="muted">
        Each item at its total times worn and current cost per wear (log scale). The grey trail behind an item
        shows how its cost per wear fell with every wear; the blue guides show the same for set prices.
      </p>
      <CostVsWearsChart rows={rows} />
      {rangeControl}

      <h3>Cost per wear and frequency of use</h3>
      <p className="muted">
        Cost per wear (log scale) against how often the item is worn. The dotted lines mark the divested
        items' averages (items owned at least 30 days).
      </p>
      <CostVsFrequencyChart rows={rows} />
      {rangeControl}

      <h3>Times worn – animated by date</h3>
      <p className="muted">Times worn as of the chosen date. Press play to watch the items being worn.</p>
      <TimesWornAnimation garments={garments} days={wardrobe.days} range={range} />
      {rangeControl}

      <h3>Cost per wear and frequency of use – animated by date</h3>
      <p className="muted">
        Cost per wear and frequency of use as of the chosen date, counting only the wears logged by then.
      </p>
      <CostVsFrequencyAnimation garments={garments} days={wardrobe.days} range={range} />
      {rangeControl}

      <h3>Daily cost</h3>
      <p className="muted">
        Daily cost of the {category.toLowerCase()} used on a particular day: the sum of their cost per wear.
        “All divested” means the daily cost is final and no longer decreases with future use.
      </p>
      <DailyCostChart garments={garments} days={wardrobe.days} range={range} yMax="auto" />
      {rangeControl}
    </section>
  );
}
