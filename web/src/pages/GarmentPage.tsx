// Public page for one garment (R-30): photo, all its details, composition, lifetime stats and wears over time.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import { formatEur2 } from "../components/CategoryCharts";
import { CategoryLink } from "../components/CategoryLink";
import { Link } from "../components/Link";
import { PlotFigure } from "../components/PlotFigure";
import { photoUrl } from "../firebase";
import { categorySlug } from "../lib/categories";
import { formatFi, todayIso } from "../lib/dates";
import { fibreClass, parseMaterials, type FibreClass } from "../lib/materials";
import { itemListing, TRACKING_START } from "../lib/metrics";
import type { Wardrobe } from "../lib/publicData";

export const CLASS_COLORS: Record<FibreClass, string> = {
  natural: "var(--fibre-natural)",
  regenerated: "var(--fibre-regenerated)",
  synthetic: "var(--fibre-synthetic)",
  other: "var(--fibre-other)",
};
export const CLASS_LABELS: Record<FibreClass, string> = {
  natural: "Natural",
  regenerated: "Regenerated cellulose",
  synthetic: "Synthetic",
  other: "Other",
};

export function GarmentPage({ id, wardrobe, canEdit }: { id: string; wardrobe: Wardrobe | null; canEdit: boolean }) {
  const g = wardrobe?.garments.find((x) => x.id === id);
  const row = useMemo(
    () => (wardrobe && g ? itemListing([g], wardrobe.days, { from: TRACKING_START, to: todayIso() })[0] : undefined),
    [wardrobe, g],
  );
  const dates = useMemo(() => (wardrobe && g ? wardrobe.days.filter((d) => d.worn.includes(g.id)).map((d) => d.date) : []), [wardrobe, g]);
  const materials = useMemo(() => parseMaterials(g?.materials), [g]);

  const options = useCallback(
    (width: number): Plot.PlotOptions => ({
      width,
      height: 180,
      marginLeft: 32,
      x: { type: "utc", label: null },
      y: { label: "Wears per month", labelArrow: "none", grid: true, tickFormat: "d" },
      marks: [
        Plot.rectY(dates.map((d) => new Date(`${d}T00:00:00Z`)), {
          ...Plot.binX({ y: "count" }, { x: (d: Date) => d, interval: "month" }),
          fill: "var(--accent)",
          fillOpacity: 0.7,
          inset: 0.5,
          tip: true,
        }),
        Plot.ruleY([0]),
      ],
    }),
    [dates],
  );

  if (!wardrobe) return <p>Loading…</p>;
  if (!g) return <section><Link to={{ page: "dashboard" }}>← Dashboard</Link><p>No garment with id {id}.</p></section>;
  const src = photoUrl(g);
  const active = row ? row.active : !g.divested;

  return (
    <section className="garment-page">
      <Link to={{ page: "category", slug: categorySlug(g.category) }}>← {g.category}</Link>
      <div className="garment-head">
        {src && <img src={src} alt="" />}
        <div>
          <h2>{g.item}</h2>
          <p className="muted">
            <CategoryLink category={g.category} /> · {active ? "Active" : `Divested ${formatFi(g.divested)}`}
          </p>
          {canEdit && <Link className="button" to={{ page: "manage", id: g.id }}>Edit</Link>}
        </div>
      </div>

      <dl className="facts">
        <dt>Price</dt><dd>{g.price == null ? "–" : formatEur2(g.price)}</dd>
        <dt>Purchased</dt><dd>{formatFi(g.purchased) || "–"}</dd>
        {g.divested && <><dt>Divested</dt><dd>{formatFi(g.divested)}</dd></>}
        <dt>Weight</dt><dd>{g.weightG ? `${g.weightG} g` : "–"}</dd>
        {g.details && <><dt>Details</dt><dd>{g.details}</dd></>}
        <dt>Materials</dt><dd className="pre">{g.materials || "–"}</dd>
      </dl>

      {materials.main.length > 0 && (
        <div className="composition">
          <div className="composition-bar" role="img" aria-label={materials.main.map((c) => `${c.fibre} ${Math.round(c.share * 100)} %`).join(", ")}>
            {materials.main.map((c) => (
              <span key={c.fibre} style={{ width: `${c.share * 100}%`, background: CLASS_COLORS[fibreClass(c.fibre)] }} />
            ))}
          </div>
          <ul className="chart-legend">
            {materials.main.map((c) => (
              <li key={c.fibre}>
                <span className="swatch-box" style={{ background: CLASS_COLORS[fibreClass(c.fibre)] }} />
                {c.fibre} {Math.round(c.share * 100)} %{c.recycled ? " (recycled)" : ""}{c.organic ? " (organic)" : ""}
              </li>
            ))}
          </ul>
          <p className="muted">
            {materials.parts.length > 1 && `Main part (${materials.mainLabel ?? "the first"} of ${materials.parts.length} parts). `}
            {materials.estimated && "Shares are estimated (the text gives no percentages, or they don't add up to 100). "}
            Colour = fibre type: {(Object.keys(CLASS_LABELS) as FibreClass[]).map((k, i) => (
              <span key={k}>{i > 0 && ", "}<span className="swatch-box" style={{ background: CLASS_COLORS[k] }} /> {CLASS_LABELS[k].toLowerCase()}</span>
            ))}.
          </p>
        </div>
      )}

      <div className="stat-tiles">
        <div><strong>{row?.lifetimeWears ?? g.timesUsedInit}</strong><span>times worn{g.timesUsedInit ? ` (${g.timesUsedInit} before tracking)` : ""}</span></div>
        <div><strong>{row?.costPerWear == null ? "–" : formatEur2(row.costPerWear)}</strong><span>cost per wear</span></div>
        <div><strong>{row ? row.wearsPerMonth.toFixed(1).replace(".", ",") : "–"}</strong><span>wears per month</span></div>
        <div><strong>{dates.length ? formatFi(dates[dates.length - 1]) : "–"}</strong><span>last worn{dates.length ? ` (first ${formatFi(dates[0])})` : ""}</span></div>
      </div>

      {dates.length > 0 && (
        <>
          <h3>Wears per month</h3>
          <figure className="chart"><PlotFigure options={options} /></figure>
        </>
      )}
    </section>
  );
}
