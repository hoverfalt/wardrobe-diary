import { useMemo, useState } from "react";
import { usePublicWardrobe } from "../data/repo";
import { categoryImageUrl } from "../firebase";
import { barMax, barStyle } from "../lib/dataBars";
import { todayIso } from "../lib/dates";
import { ActiveItemsLines, ActiveItemsSmallMultiples } from "../components/ActiveItemsCharts";
import { activeItemsOverTime, categoryListing, TRACKING_START, type CategoryRow, type DateRange } from "../lib/metrics";

const eur0 = (v: number | null) =>
  v == null ? "–" : v.toLocaleString("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = (v: number | null) =>
  v == null ? "–" : v.toLocaleString("fi-FI", { style: "currency", currency: "EUR" });
const pct = (v: number | null) => (v == null ? "–" : `${(v * 100).toFixed(0)} %`);

// Columns with data bars, as on the live site: colour, and the bar maximum (the largest category value,
// Total row excluded; Days used is a share, so its maximum is fixed at 100 %).
const COLUMNS: {
  key: Exclude<keyof CategoryRow, "category">;
  title: string;
  format: (v: number | null) => string;
  bar: string;
  fixedMax?: number;
}[] = [
  { key: "activeItems", title: "Active items", format: (v) => String(v ?? "–"), bar: "var(--bar-grey)" },
  { key: "inventoryValue", title: "Inventory value", format: eur0, bar: "var(--bar-blue)" },
  { key: "costPerWear", title: "Cost per wear", format: eur2, bar: "var(--bar-red)" },
  { key: "daysUsed", title: "Days used", format: pct, bar: "var(--bar-green)", fixedMax: 1 },
  { key: "yearlyCost", title: "Yearly cost", format: eur0, bar: "var(--bar-red)" },
  { key: "turnover", title: "Inventory turnover", format: pct, bar: "var(--bar-grey)" },
];

export function Dashboard({ ownerUid }: { ownerUid: string }) {
  const wardrobe = usePublicWardrobe(ownerUid);
  const garments = wardrobe?.garments;
  const days = wardrobe?.days;
  const [range, setRange] = useState<DateRange>({ from: TRACKING_START, to: todayIso() });
  const rows = useMemo(
    () => (garments && days && range.from <= range.to ? categoryListing(garments, days, range) : []),
    [garments, days, range],
  );
  // As on the live site, the chart leaves out Sportswear.
  const activeSeries = useMemo(
    () =>
      garments && range.from <= range.to
        ? activeItemsOverTime(garments, range).filter((s) => s.category !== "Sportswear")
        : [],
    [garments, range],
  );
  const maxima = useMemo(() => {
    const categories = rows.filter((r) => r.category !== "Total");
    return Object.fromEntries(COLUMNS.map((c) => [c.key, c.fixedMax ?? barMax(categories.map((r) => r[c.key]))]));
  }, [rows]);

  if (!garments || !days) return <p>Loading…</p>;

  return (
    <section>
      <h2>Category listing</h2>
      <p className="range">
        <label>
          From <input type="date" value={range.from} min={TRACKING_START} max={range.to}
            onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} />
        </label>
        <label>
          To <input type="date" value={range.to} min={range.from}
            onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} />
        </label>
      </p>
      {range.from > TRACKING_START && (
        <p className="muted">
          Ranges starting after {TRACKING_START} are provisional: only wears inside the range count.
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th aria-label="Image" />
              <th>Category</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="num">{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const img = r.category === "Total" ? null : categoryImageUrl(r.category);
              return (
                <tr key={r.category} className={r.category === "Total" ? "total" : undefined}>
                  <td className="img">{img && <img className="category-image" src={img} alt="" />}</td>
                  <td>{r.category}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="num" style={barStyle(r[c.key], maxima[c.key], c.bar)}>
                      {c.format(r[c.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Active items by category</h2>
      <p className="muted">Number of active items in each category (Sportswear not included).</p>
      <h3>A: one chart</h3>
      <p className="muted">Hover a category in the legend to highlight it; click to keep it highlighted.</p>
      <ActiveItemsLines series={activeSeries} range={range} />
      <h3>B: small multiples</h3>
      <p className="muted">One chart per category on the same scale; the number is the count at the end date.</p>
      <ActiveItemsSmallMultiples series={activeSeries} range={range} />
    </section>
  );
}
