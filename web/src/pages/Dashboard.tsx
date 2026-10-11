import { useMemo, useState, type ReactNode } from "react";
import { SortHeader } from "../components/SortHeader";
import { nextSort, sortRows, type SortDir } from "../lib/sorting";
import type { Wardrobe } from "../lib/publicData";
import { categoryImageUrl } from "../firebase";
import { barMax, barStyle } from "../lib/dataBars";
import { DailyCostAnimation, DailyCostChart } from "../components/DailyCostCharts";
import {
  CategoryScatter,
  CategorySmallMultiples,
  formatCount,
  formatEur,
  formatEur2,
  TotalChart,
  type ScatterPoint,
} from "../components/CategoryCharts";
import { CategoryLink } from "../components/CategoryLink";
import { Link } from "../components/Link";
import {
  activeItemsOverTime,
  categoryListing,
  inventoryValueOverTime,
  totalInventoryValueOverTime,
  type CategoryRow,
  type DateRange,
} from "../lib/metrics";

const eur0 = (v: number | null) =>
  v == null ? "–" : formatEur(v);
const eur2 = (v: number | null) =>
  v == null ? "–" : formatEur2(v);
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
  { key: "activeItems", title: "Items", format: (v) => String(v ?? "–"), bar: "var(--bar-grey)" },
  { key: "inventoryValue", title: "Value", format: eur0, bar: "var(--bar-blue)" },
  { key: "costPerWear", title: "Cost per wear", format: eur2, bar: "var(--bar-red)" },
  { key: "daysUsed", title: "Days used", format: pct, bar: "var(--bar-green)", fixedMax: 1 },
  { key: "yearlyCost", title: "Yearly cost", format: eur0, bar: "var(--bar-red)" },
  { key: "turnover", title: "Turnover", format: pct, bar: "var(--bar-grey)" },
  // Share of active items bought second hand; a share, so its bar maximum is fixed at 100 %.
  { key: "secondHandShare", title: "Second hand", format: pct, bar: "var(--bar-green)", fixedMax: 1 },
];

const COST_VS_USE_TIP: [string, string] = ["Frequency of use", "Cost per wear"];
const YEARLY_VS_USE_TIP: [string, string] = ["Frequency of use", "Yearly cost"];

export function Dashboard({
  wardrobe,
  range,
  rangeControl,
}: {
  wardrobe: Wardrobe | null;
  range: DateRange;
  /** The shared date range control; rendered at the top and under each chart section. */
  rangeControl: ReactNode;
}) {
  const garments = wardrobe?.garments;
  const days = wardrobe?.days;

  const rows = useMemo(
    () => (garments && days ? categoryListing(garments, days, range) : []),
    [garments, days, range],
  );
  // As on the live site, the charts over time leave out Sportswear.
  const charts = useMemo(() => {
    if (!garments) return null;
    const notSportswear = garments.filter((g) => g.category !== "Sportswear");
    return {
      notSportswear,
      activeItems: activeItemsOverTime(notSportswear, range),
      inventoryValue: inventoryValueOverTime(notSportswear, range),
      totalValue: totalInventoryValueOverTime(notSportswear, range),
    };
  }, [garments, range]);
  // Cost per wear vs frequency of use: one point per category (Sportswear included, as on the live site).
  const costVsUse = useMemo(
    () =>
      rows.flatMap((r): ScatterPoint[] =>
        r.category !== "Total" && r.costPerWear != null && r.daysUsed != null
          ? [{ category: r.category, x: r.daysUsed, y: r.costPerWear }]
          : [],
      ),
    [rows],
  );
  const yearlyVsUse = useMemo(
    () =>
      rows.flatMap((r): ScatterPoint[] =>
        r.category !== "Total" && r.yearlyCost != null && r.daysUsed != null
          ? [{ category: r.category, x: r.daysUsed, y: r.yearlyCost }]
          : [],
      ),
    [rows],
  );
  // Sorting: "category" = the standard category order (default); the Total row always stays first.
  type SortKey = "category" | (typeof COLUMNS)[number]["key"];
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "category", dir: "asc" });
  const sortedRows = useMemo(() => {
    if (sort.key === "category") return rows;
    const key = sort.key;
    const [total, ...categories] = rows;
    return total ? [total, ...sortRows(categories, (r) => r[key], sort.dir)] : rows;
  }, [rows, sort]);

  const maxima = useMemo(() => {
    const categories = rows.filter((r) => r.category !== "Total");
    return Object.fromEntries(COLUMNS.map((c) => [c.key, c.fixedMax ?? barMax(categories.map((r) => r[c.key]))]));
  }, [rows]);

  if (!garments || !days) return <p>Loading…</p>;

  return (
    <section>
      <h2>Category listing</h2>
      <p className="muted">
        What the wardrobe is made of, by weight and fibre: see <Link to={{ page: "materials" }}>Materials</Link>.
      </p>
      {rangeControl}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th aria-label="Image" />
              <SortHeader title="Category" active={sort.key === "category"} dir="asc" showArrow={false} hint="Back to the standard category order"
                onClick={() => setSort({ key: "category", dir: "asc" })} />
              {COLUMNS.map((c) => (
                <SortHeader key={c.key} className="num" title={c.title} active={sort.key === c.key} dir={sort.dir}
                  onClick={() => setSort(nextSort(sort, c.key, "number"))} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => {
              const img = r.category === "Total" ? null : categoryImageUrl(r.category);
              return (
                <tr key={r.category} className={r.category === "Total" ? "total" : undefined}>
                  <td className="img">{img && <img className="category-image" src={img} alt="" />}</td>
                  <td>{r.category === "Total" ? r.category : <CategoryLink category={r.category} />}</td>
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

      {charts && (
        <>
          <h2>Active items by category</h2>
          <p className="muted">Number of active items in each category; the number is the count at the end date.</p>
          <CategorySmallMultiples series={charts.activeItems} range={range} format={formatCount} />
          {rangeControl}

          <h2>Inventory value by category</h2>
          <p className="muted">
            Sum of the value of active items in each category. The value of an item is its purchase price.
          </p>
          <CategorySmallMultiples series={charts.inventoryValue} range={range} format={formatEur} />
          {rangeControl}

          <h2>Total inventory value</h2>
          <p className="muted">Total value of active items. The value of an item is its purchase price.</p>
          <TotalChart points={charts.totalValue} range={range} format={formatEur} />
          {rangeControl}

          <p className="muted">
            Sportswear is not included in the charts above, as on wardrobediary.io.
          </p>

          <h2>Average cost per wear and category frequency of use</h2>
          <p className="muted">
            Average cost per wear by category. Category frequency of use is the share of all days in which any
            item in the category was used.
          </p>
          <CategoryScatter
            points={costVsUse}
            xLabel="Category frequency of use (share of all days)"
            yLabel="Average cost per wear"
            yFormat={formatEur2}
            yTickFormat={formatEur}
            tipLabels={COST_VS_USE_TIP}
          />
          {rangeControl}

          <h2>Average yearly cost and category frequency of use</h2>
          <p className="muted">
            Yearly cost of using the items in a particular category. Frequency of use is the share of all days in
            which any item in the category was used.
          </p>
          <CategoryScatter
            points={yearlyVsUse}
            xLabel="Category frequency of use (share of all days)"
            yLabel="Average yearly cost"
            yFormat={formatEur}
            tipLabels={YEARLY_VS_USE_TIP}
          />
          {rangeControl}

          <h2>Daily cost</h2>
          <p className="muted">
            Daily cost of all items used on a particular day: the sum of their cost per wear. “All divested”
            means the daily cost is final and no longer decreases with future use. Sportswear not included.
          </p>
          <DailyCostChart garments={charts.notSportswear} days={days!} range={range} />
          {rangeControl}

          <h2>Daily cost – animated by date</h2>
          <p className="muted">
            Daily costs as they looked on the “as of” date, counting only the wears logged by then. Press play
            to watch the cost of past days fall as the garments worn on them get more use.
          </p>
          <DailyCostAnimation garments={charts.notSportswear} days={days!} range={range} />
          {rangeControl}
        </>
      )}
    </section>
  );
}
