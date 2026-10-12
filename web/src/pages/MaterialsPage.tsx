// Materials page (R-30): fibre mass owned and worn, the fibre mix per category, and monthly trends, all from
// weight × the composition read from the Materials field. Follows the app-wide date range.
import { useMemo, type ReactNode } from "react";
import { Link } from "../components/Link";
import { CategoryFibreMultiples, FibreBars, FibreLegend, MonthLine } from "../components/MaterialsCharts";
import { compareCategories } from "../lib/categories";
import { formatFi } from "../lib/dates";
import { fibreClass, materialBreakdown, materialsByMonth } from "../lib/materials";
import type { DateRange } from "../lib/metrics";
import type { Wardrobe } from "../lib/publicData";
import { hasTag } from "../lib/tags";

const kg = (v: number) => `${v.toLocaleString("fi-FI", { maximumFractionDigits: 1 })} kg`;
const pct = (v: number) => `${Math.round(v * 100)} %`;

export function MaterialsPage({ wardrobe, range, rangeControl }: { wardrobe: Wardrobe | null; range: DateRange; rangeControl: ReactNode }) {
  const data = useMemo(() => {
    if (!wardrobe) return null;
    const { garments, days } = wardrobe;
    const owned = materialBreakdown(garments, days, range, "owned");
    const worn = materialBreakdown(garments, days, range, "worn");
    const categories = [...new Set(garments.map((g) => g.category))].sort(compareCategories).map((category) => {
      const b = materialBreakdown(garments.filter((g) => g.category === category), days, range, "owned");
      return { category, fibres: b.fibres, totalKg: b.totalKg };
    });
    const months = materialsByMonth(garments, days, range);
    const secondHandKg = materialBreakdown(garments.filter((g) => hasTag(g, "second-hand")), days, range, "owned").totalKg;
    const synthetic = (fibres: typeof worn.fibres) => fibres.filter((f) => fibreClass(f.fibre) === "synthetic").reduce((s, f) => s + f.share, 0);
    const share = (fibres: typeof owned.fibres, key: "recycledKg" | "organicKg", total: number) => (total ? fibres.reduce((s, f) => s + f[key], 0) / total : 0);
    return {
      owned,
      worn,
      categories,
      months,
      syntheticWorn: synthetic(worn.fibres),
      recycledOwned: share(owned.fibres, "recycledKg", owned.totalKg),
      organicOwned: share(owned.fibres, "organicKg", owned.totalKg),
      secondHandOwned: owned.totalKg ? secondHandKg / owned.totalKg : 0,
    };
  }, [wardrobe, range]);

  if (!wardrobe || !data) return <p>Loading…</p>;
  const { owned, worn } = data;
  const maxKg = Math.max(...owned.fibres.map((f) => f.kg), 0.001);

  return (
    <section>
      <Link to={{ page: "dashboard" }}>← Dashboard</Link>
      <h2>Materials</h2>
      <p className="muted">
        What the wardrobe is made of, by weight: each garment's weight × the fibre composition read from its
        materials label (the main fabric for garments with several parts).
      </p>
      {rangeControl}

      <div className="stat-tiles">
        <div><strong>{kg(owned.totalKg)}</strong><span>owned on {formatFi(range.to)}</span></div>
        <div><strong>{kg(worn.totalKg)}</strong><span>worn in the period (every wear counts the full weight)</span></div>
        <div><strong>{kg(worn.averageOutfitKg ?? 0)}</strong><span>average outfit per day</span></div>
        <div><strong>{pct(data.syntheticWorn)}</strong><span>of the worn mass is synthetic</span></div>
        <div><strong>{pct(data.recycledOwned)} / {pct(data.organicOwned)}</strong><span>recycled / organic (owned)</span></div>
        <div><strong>{pct(data.secondHandOwned)}</strong><span>of the owned mass bought second hand</span></div>
      </div>

      <h3>Fibres owned</h3>
      <p className="muted">Garments active at the end of the period.</p>
      <FibreLegend />
      <figure className="chart"><FibreBars fibres={owned.fibres} /></figure>

      <h3>Fibres worn</h3>
      <p className="muted">Every wear in the period counts the garment's full weight; hover a bar for recycled and organic.</p>
      <figure className="chart"><FibreBars fibres={worn.fibres} /></figure>
      {rangeControl}

      <h3>Fibre mix by category</h3>
      <p className="muted">Share of each category's owned mass (top five fibres); the number is the category's total weight.</p>
      <CategoryFibreMultiples rows={data.categories} />
      {rangeControl}

      <h3>Average outfit weight per month</h3>
      <MonthLine data={data.months.map((m) => ({ month: m.month, value: m.averageOutfitKg }))} format={kg} color="var(--accent)" />
      <h3>Synthetic share of the worn mass per month</h3>
      <MonthLine data={data.months.map((m) => ({ month: m.month, value: m.syntheticShare }))} format={pct} color="var(--fibre-synthetic)" />
      {rangeControl}

      <p className="muted">
        Coverage: {owned.coverage.included} of {owned.coverage.total} owned garments and {worn.coverage.included} of{" "}
        {worn.coverage.total} wears had both a weight and readable materials ({owned.coverage.missingWeight} owned garments
        lack a weight, {owned.coverage.missingMaterials} materials; {owned.coverage.estimated} rest on estimated shares).
        Largest owned fibre: {owned.fibres[0] ? `${owned.fibres[0].fibre} (${kg(maxKg)})` : "–"}.
      </p>
    </section>
  );
}
