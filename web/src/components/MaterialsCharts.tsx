// Charts for the materials page (R-30): fibre mass bars coloured by fibre type, the fibre mix per category
// as small multiples (D-3), and monthly lines.
import * as Plot from "@observablehq/plot";
import { useCallback } from "react";
import { categoryImageUrl } from "../firebase";
import { fibreClass, type FibreClass, type FibreMass } from "../lib/materials";
import { CLASS_COLORS, CLASS_LABELS } from "../pages/GarmentPage";
import { PlotFigure } from "./PlotFigure";

const kg = (v: number) => `${v.toLocaleString("fi-FI", { maximumFractionDigits: v < 10 ? 1 : 0 })} kg`;
const pct = (v: number) => `${Math.round(v * 100)} %`;

export function FibreLegend() {
  return (
    <ul className="chart-legend" aria-label="Fibre types">
      {(Object.keys(CLASS_LABELS) as FibreClass[]).map((k) => (
        <li key={k}><span className="swatch-box" style={{ background: CLASS_COLORS[k] }} /> {CLASS_LABELS[k]}</li>
      ))}
    </ul>
  );
}

/** The ten largest fibres; the rest folded into one "other fibres" row (shown grey). */
function topFibres(all: FibreMass[], n = 10): FibreMass[] {
  if (all.length <= n + 1) return all;
  const rest = all.slice(n);
  const sum = (k: "kg" | "share" | "recycledKg" | "organicKg") => rest.reduce((s, f) => s + f[k], 0);
  return [...all.slice(0, n), { fibre: `other fibres (${rest.length})`, kg: sum("kg"), share: sum("share"), recycledKg: sum("recycledKg"), organicKg: sum("organicKg") }];
}

/** Horizontal bars of fibre mass, largest first, with direct value labels. */
export function FibreBars({ fibres: all, max }: { fibres: FibreMass[]; max?: number }) {
  const fibres = topFibres(all);
  const options = useCallback(
    (width: number): Plot.PlotOptions => ({
      width,
      height: fibres.length * 26 + 30,
      marginLeft: 120,
      marginRight: 70,
      x: { label: null, axis: null, domain: [0, max ?? Math.max(...fibres.map((f) => f.kg), 0.001)] },
      y: { label: null, domain: fibres.map((f) => f.fibre), tickSize: 0 },
      marks: [
        Plot.barX(fibres, { y: "fibre", x: "kg", fill: (d: FibreMass) => CLASS_COLORS[fibreClass(d.fibre)], insetTop: 3, insetBottom: 3, rx: 2 }),
        Plot.text(fibres, { y: "fibre", x: "kg", text: (d: FibreMass) => `${kg(d.kg)} · ${pct(d.share)}`, textAnchor: "start", dx: 6, fill: "currentColor" }),
        Plot.tip(fibres, Plot.pointerY({
          y: "fibre",
          x: "kg",
          title: (d: FibreMass) =>
            `${d.fibre}: ${kg(d.kg)} (${pct(d.share)})${d.recycledKg ? `\nrecycled ${kg(d.recycledKg)}` : ""}${d.organicKg ? `\norganic ${kg(d.organicKg)}` : ""}\n${CLASS_LABELS[fibreClass(d.fibre)]}`,
        })),
      ],
    }),
    [all, max],
  );
  if (fibres.length === 0) return <p className="muted">No garments with both a weight and readable materials.</p>;
  return <PlotFigure options={options} />;
}

/** One small chart per category: the shares of its top fibres (owned), on a shared 0–100 % scale. */
export function CategoryFibreMultiples({ rows }: { rows: { category: string; fibres: FibreMass[]; totalKg: number }[] }) {
  return (
    <div className="multiples">
      {rows.map((r) => (
        <CategoryFibres key={r.category} {...r} />
      ))}
    </div>
  );
}

function CategoryFibres({ category, fibres, totalKg }: { category: string; fibres: FibreMass[]; totalKg: number }) {
  const top = fibres.slice(0, 5);
  const img = categoryImageUrl(category);
  const options = useCallback(
    (width: number): Plot.PlotOptions => ({
      width,
      height: top.length * 22 + 10,
      marginLeft: 92,
      marginRight: 40,
      marginTop: 4,
      marginBottom: 4,
      x: { domain: [0, 1], axis: null },
      y: { domain: top.map((f) => f.fibre), label: null, tickSize: 0 },
      marks: [
        Plot.barX(top, { y: "fibre", x: "share", fill: (d: FibreMass) => CLASS_COLORS[fibreClass(d.fibre)], insetTop: 3, insetBottom: 3, rx: 2 }),
        Plot.text(top, { y: "fibre", x: "share", text: (d: FibreMass) => pct(d.share), textAnchor: "start", dx: 4, fill: "currentColor" }),
      ],
    }),
    [top],
  );
  return (
    <figure className="multiple">
      <figcaption>
        {img && <img className="category-image" src={img} alt="" />}
        <span>{category}</span>
        <span className="muted">{totalKg ? kg(totalKg) : ""}</span>
      </figcaption>
      {top.length ? <PlotFigure options={options} /> : <p className="muted">No measurable garments.</p>}
    </figure>
  );
}

/** A monthly line (one measure per chart: never two y-scales). */
export function MonthLine({ data, format, color }: { data: { month: string; value: number | null }[]; format: (v: number) => string; color: string }) {
  const points = data.filter((d) => d.value != null).map((d) => ({ date: new Date(`${d.month}-15T00:00:00Z`), value: d.value!, month: d.month }));
  const options = useCallback(
    (width: number): Plot.PlotOptions => ({
      width,
      height: 220,
      marginLeft: 50,
      x: { type: "utc", label: null },
      y: { label: null, grid: true, zero: true, tickFormat: format },
      marks: [
        Plot.lineY(points, { x: "date", y: "value", stroke: color, strokeWidth: 1.5, curve: "monotone-x" }),
        Plot.ruleX(points, Plot.pointerX({ x: "date", stroke: "currentColor", strokeOpacity: 0.3 })),
        Plot.tip(points, Plot.pointerX({ x: "date", y: "value", title: (d: (typeof points)[number]) => `${d.month}: ${format(d.value)}` })),
      ],
    }),
    [points, format, color],
  );
  return points.length ? <figure className="chart"><PlotFigure options={options} /></figure> : null;
}
