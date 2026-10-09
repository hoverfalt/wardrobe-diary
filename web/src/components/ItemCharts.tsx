// Item scatter charts for category pages, with each item drawn as its photo (divested items in a green
// ring, as on the live site) and cost per wear on a log scale.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import { photoUrl } from "../firebase";
import { divestedAverages, type ItemRow } from "../lib/metrics";
import { formatEur2 } from "./CategoryCharts";
import { PlotFigure } from "./PlotFigure";

const DIVESTED = "#3CB371"; // live site: mediumseagreen
const GUIDE = "#7fb8d6"; // live site: lightblue
// Live site: plot_log_breaks (plus 0.01 and 0.02 for the cheapest socks) and guides_prices
const LOG_TICKS = [0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 400, 800];
const GUIDE_PRICES = [5, 10, 20, 50, 100, 200, 400, 800];
const FI = new Intl.NumberFormat("fi-FI");
const eurTick = (v: number) => (v < 1 ? formatEur2(v) : `${FI.format(v)} €`);

interface Point {
  row: ItemRow;
  x: number;
  y: number;
  src: string;
  name: string;
  active: boolean;
}

/** Photo markers: divested items first in a green ring, active items on top. */
function itemMarks(points: Point[], r: number, tip: (p: Point) => string): Plot.Markish[] {
  const divested = points.filter((p) => !p.active);
  const active = points.filter((p) => p.active);
  return [
    Plot.dot(divested, { x: "x", y: "y", r: r + 3, fill: DIVESTED, fillOpacity: 0.8 }),
    Plot.image(divested, { x: "x", y: "y", src: "src", r, preserveAspectRatio: "xMidYMid slice" }),
    Plot.image(active, { x: "x", y: "y", src: "src", r, preserveAspectRatio: "xMidYMid slice" }),
    Plot.tip(points, Plot.pointer({ x: "x", y: "y", title: tip })),
  ];
}

/** Cost-per-wear axis and grid with every LOG_TICKS value inside the domain labelled. The labels are
 *  drawn as text marks: on log scales the axis' own labels get thinned by d3, even for explicit ticks. */
function logAxis([lo, hi]: [number, number]): Plot.Markish[] {
  const ticks = LOG_TICKS.filter((t) => t >= lo && t <= hi);
  return [
    Plot.gridY(ticks),
    Plot.axisY(ticks, { tickFormat: () => "", label: "Cost per wear", labelArrow: "none" }),
    Plot.text(ticks, { y: (d: number) => d, text: eurTick, frameAnchor: "left", textAnchor: "end", dx: -9, fontSize: 10 }),
  ];
}

function logDomain(values: number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return [lo / 1.5, hi * 1.5];
}

const markerRadius = (width: number, n: number) => Math.round(Math.max(9, Math.min(20, width / 45, 600 / Math.sqrt(n * 6))));

function toPoints(rows: ItemRow[], x: (r: ItemRow) => number): Point[] {
  return rows
    .filter((r) => r.costPerWear != null && r.costPerWear > 0)
    .map((r) => ({
      row: r,
      x: x(r),
      y: r.costPerWear!,
      src: photoUrl(r.garment.photo) ?? "",
      name: r.garment.item,
      active: r.active,
    }));
}

/** Cost per wear vs times worn (live site: "Cost_and_Cumulative_use"). Grey trails show how each item's
 *  cost per wear fell with every wear (price / n); blue guides show the same curve for set prices. */
export function CostVsWearsChart({ rows }: { rows: ItemRow[] }) {
  const points = useMemo(() => toPoints(rows, (r) => r.lifetimeWears), [rows]);
  const options = useCallback(
    (width: number): Plot.PlotOptions => {
      const [yMin, yMax] = logDomain(points.map((p) => p.y));
      const xMax = Math.max(10, ...points.map((p) => p.x)) * 1.05;
      // price / n for n = 1 … until it leaves the plot; log-spaced n keeps the curves smooth and light.
      const curve = (price: number, nMax: number, id: string) => {
        const out: { id: string; n: number; c: number }[] = [];
        for (let n = Math.max(1, price / yMax); n <= nMax; n = Math.max(n * 1.06, n + 0.5)) out.push({ id, n, c: price / n });
        out.push({ id, n: nMax, c: price / nMax });
        return out.filter((d) => d.c >= yMin);
      };
      const trails = points.filter((p) => p.x >= 1).flatMap((p) => curve(p.row.garment.price!, p.x, p.row.garment.id));
      const guides = GUIDE_PRICES.flatMap((price) => curve(price, xMax, String(price)));
      const guideLabels = GUIDE_PRICES.map((price) => {
        const g = guides.filter((d) => d.id === String(price));
        return g.length > 1 ? { ...g[g.length - 1], label: `${price} €` } : null;
      }).filter((d) => d !== null);
      const r = markerRadius(width, points.length);
      return {
        width,
        height: Math.min(640, Math.max(360, width * 0.7)),
        marginLeft: 56,
        marginRight: 40,
        marginTop: r + 6,
        x: { domain: [0, xMax], insetLeft: r + 4, label: "Times worn", labelAnchor: "center", labelArrow: "none", grid: true, tickFormat: (v: number) => FI.format(v) },
        y: { type: "log", domain: [yMin, yMax] },
        marks: [
          ...logAxis([yMin, yMax]),
          Plot.line(guides, { x: "n", y: "c", z: "id", stroke: GUIDE, strokeWidth: 1.5, strokeOpacity: 0.8 }),
          Plot.text(guideLabels, { x: "n", y: "c", text: "label", fill: GUIDE, textAnchor: "start", dx: 4, fontWeight: 600 }),
          Plot.line(trails, { x: "n", y: "c", z: "id", stroke: "currentColor", strokeOpacity: 0.15, strokeWidth: 2 }),
          ...itemMarks(points, r, (p) =>
            `${p.name}\nTimes worn: ${p.x}\nCost per wear: ${formatEur2(p.y)}\nPrice: ${formatEur2(p.row.garment.price!)}\n${p.active ? "Active" : "Divested"}`),
        ],
      };
    },
    [points],
  );
  if (points.length === 0) return null;
  return (
    <figure className="chart">
      <ul className="chart-legend" aria-label="Legend">
        <li><span className="dot" style={{ background: DIVESTED }} /> Divested</li>
        <li><span className="line" style={{ background: "currentColor", opacity: 0.3 }} /> Item's cost per wear over time</li>
        <li><span className="line" style={{ background: GUIDE }} /> Price ÷ times worn for set prices</li>
      </ul>
      <PlotFigure options={options} />
    </figure>
  );
}

/** Cost per wear vs wears per month (live site: the main category chart), with dotted lines at the
 *  divested items' averages. */
export function CostVsFrequencyChart({
  rows,
  xDomain,
  yDomain,
}: {
  rows: ItemRow[];
  /** Fixed scales (the animation keeps them still); values beyond the x maximum are drawn at the edge. */
  xDomain?: [number, number];
  yDomain?: [number, number];
}) {
  const points = useMemo(
    () => toPoints(rows, (r) => (xDomain ? Math.min(r.wearsPerMonth, xDomain[1]) : r.wearsPerMonth)),
    [rows, xDomain],
  );
  const avg = useMemo(() => divestedAverages(rows), [rows]);
  const options = useCallback(
    (width: number): Plot.PlotOptions => {
      const [yMin, yMax] = yDomain ?? logDomain(points.map((p) => p.y));
      const xMax = xDomain?.[1] ?? Math.max(1, ...points.map((p) => p.x)) * 1.05;
      const r = markerRadius(width, points.length);
      const fmt1 = (v: number) => v.toFixed(1).replace(".", ",");
      return {
        width,
        height: Math.min(640, Math.max(360, width * 0.7)),
        marginLeft: 56,
        marginRight: r + 8,
        marginTop: r + 6,
        x: { domain: [0, xMax], insetLeft: r + 4, label: "Average times worn per month", labelAnchor: "center", labelArrow: "none", grid: true, tickFormat: fmt1 },
        y: { type: "log", domain: [yMin, yMax] },
        marks: [
          ...logAxis([yMin, yMax]),
          ...(avg
            ? [
                Plot.ruleX([avg.wearsPerMonth], { stroke: DIVESTED, strokeDasharray: "2,4", strokeWidth: 2 }),
                Plot.ruleY([avg.costPerWear], { stroke: DIVESTED, strokeDasharray: "2,4", strokeWidth: 2 }),
                Plot.text([avg.wearsPerMonth], { x: (d: number) => d, frameAnchor: "bottom", dy: -4, dx: 4, textAnchor: "start", text: (d: number) => fmt1(d), fill: DIVESTED, fontWeight: 600 }),
                Plot.text([avg.costPerWear], { y: (d: number) => d, frameAnchor: "right", dy: -8, textAnchor: "end", text: (d: number) => formatEur2(d), fill: DIVESTED, fontWeight: 600 }),
              ]
            : []),
          ...itemMarks(points, r, (p) =>
            `${p.name}\nWears per month: ${fmt1(p.row.wearsPerMonth)}\nCost per wear: ${formatEur2(p.y)}\n${p.active ? "Active" : "Divested"}`),
        ],
      };
    },
    [points, avg, xDomain, yDomain],
  );
  if (points.length === 0) return null;
  return (
    <figure className="chart">
      <ul className="chart-legend" aria-label="Legend">
        <li><span className="dot" style={{ background: DIVESTED }} /> Divested</li>
        {avg && (
          <li>
            <span className="line dotted" style={{ borderColor: DIVESTED }} /> Divested items' averages:{" "}
            {avg.wearsPerMonth.toFixed(1).replace(".", ",")} wears per month, {formatEur2(avg.costPerWear)} per wear
          </li>
        )}
      </ul>
      <PlotFigure options={options} />
    </figure>
  );
}

/** Scales that hold every frame of an animation: cost per wear never exceeds the price, and is lowest at
 *  the end; wears per month are capped near the final maximum. */
export function animationDomains(finalRows: ItemRow[]): { x: [number, number]; y: [number, number] } {
  const cpw = finalRows.map((r) => r.costPerWear ?? 0).filter((c) => c > 0);
  const prices = finalRows.map((r) => r.garment.price ?? 0).filter((p) => p > 0);
  const xMax = Math.max(5, ...finalRows.map((r) => r.wearsPerMonth)) * 1.2;
  return { x: [0, xMax], y: [Math.min(...cpw) / 1.5, Math.max(...prices) * 1.5] };
}
