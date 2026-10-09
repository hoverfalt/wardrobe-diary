// "Daily cost" (R: calculate_daily_cost / setup_daily_cost_plot) and its animated version, where an
// "as of" date replays how the daily costs looked when only the wears up to that date were known.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import { formatFi } from "../lib/dates";
import { useAsOf } from "./AsOfControl";
import { dailyCost, type DailyCostPoint, type DateRange } from "../lib/metrics";
import type { Day, Garment } from "../types";
import { formatEur2 } from "./CategoryCharts";
import { PlotFigure } from "./PlotFigure";

// As on the live site: a fixed 0–40 € scale on the portfolio page (so the animation doesn't jump),
// summers shaded. Category pages size the scale to the category (R hard-coded one per category).
const Y_MAX = 40;
const STILL_DECREASING = "#E8615F"; // live site: indianred1
const FINAL = "#3CB371"; // live site: mediumseagreen
const AVERAGE = "#4682B4"; // live site: steelblue

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoOf = (d: Date) => d.toISOString().slice(0, 10);

function summers(range: DateRange) {
  const out: { x1: Date; x2: Date }[] = [];
  for (let y = Number(range.from.slice(0, 4)); y <= Number(range.to.slice(0, 4)); y++) {
    const from = `${y}-06-22` < range.from ? range.from : `${y}-06-22`;
    const to = `${y}-08-15` > range.to ? range.to : `${y}-08-15`;
    if (from <= to) out.push({ x1: utc(from), x2: utc(to) });
  }
  return out;
}

/** A round scale maximum covering 99 % of the days. */
export function autoYMax(points: DailyCostPoint[]): number {
  const sorted = points.map((p) => p.cost).sort((a, b) => a - b);
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 1;
  const step = p99 > 20 ? 10 : p99 > 5 ? 2 : p99 > 2 ? 1 : 0.5;
  return Math.max(step, Math.ceil(p99 / step) * step);
}

function chartOptions(points: DailyCostPoint[], range: DateRange, width: number, yMax: number): Plot.PlotOptions {
  const data = points.map((p) => ({ ...p, x: utc(p.date) }));
  const pending = data.filter((d) => !d.final);
  const final = data.filter((d) => d.final);
  const r = width < 600 ? 1.5 : 2;
  return {
    width,
    height: Math.min(460, Math.max(300, width * 0.5)),
    marginLeft: 44,
    clip: true,
    x: { type: "utc", domain: [utc(range.from), utc(range.to)], label: null },
    y: { domain: [0, yMax], label: null, grid: true, tickFormat: (v: number) => `${String(v).replace(".", ",")} €` },
    marks: [
      Plot.rectX(summers(range), { x1: "x1", x2: "x2", fill: "#f5d76e", fillOpacity: 0.15 }),
      // Secondary encoding besides colour: still-decreasing days hollow, final days filled.
      Plot.dot(pending, { x: "x", y: "cost", r, stroke: STILL_DECREASING, strokeWidth: 1 }),
      Plot.dot(final, { x: "x", y: "cost", r, fill: FINAL }),
      Plot.line(data, { x: "x", y: "average", stroke: AVERAGE, strokeWidth: 2 }),
      Plot.ruleY([0]),
      Plot.tip(
        data,
        Plot.pointerX({
          x: { value: "x", label: "" },
          y: { value: "cost", label: "Daily cost" },
          channels: {
            average: { value: "average", label: "30-day average" },
            status: { value: (d: DailyCostPoint) => (d.final ? "final" : "still decreasing"), label: "" },
          },
          format: {
            x: (d: Date) => formatFi(isoOf(d)),
            y: formatEur2,
            average: (v: number | null) => (v == null ? "–" : formatEur2(v)),
          },
        }),
      ),
    ],
  };
}

function Legend() {
  return (
    <ul className="chart-legend" aria-label="Legend">
      <li><span className="dot hollow" style={{ borderColor: STILL_DECREASING }} /> Still decreasing (some garments still in use)</li>
      <li><span className="dot" style={{ background: FINAL }} /> All divested (final)</li>
      <li><span className="line" style={{ background: AVERAGE }} /> 30-day average</li>
      <li><span className="box" /> Summer (22.6.–15.8.)</li>
    </ul>
  );
}

function Clipped({ points, yMax }: { points: DailyCostPoint[]; yMax: number }) {
  const n = points.filter((p) => p.cost > yMax).length;
  return n > 0 ? (
    <p className="muted">
      {n} {n === 1 ? "day" : "days"} above {String(yMax).replace(".", ",")} € not shown, to keep the typical days readable.
    </p>
  ) : null;
}

/** Daily cost over the range, with lifetime cost per wear (D-2). */
export function DailyCostChart({
  garments,
  days,
  range,
  yMax = Y_MAX,
}: {
  garments: Garment[];
  days: Day[];
  range: DateRange;
  /** Scale maximum in €, or "auto" to fit the data (category pages). */
  yMax?: number | "auto";
}) {
  const points = useMemo(() => dailyCost(garments, days, range), [garments, days, range]);
  const max = yMax === "auto" ? autoYMax(points) : yMax;
  const options = useCallback((width: number) => chartOptions(points, range, width, max), [points, range, max]);
  return (
    <figure className="chart">
      <Legend />
      <PlotFigure options={options} />
      <Clipped points={points} yMax={max} />
    </figure>
  );
}

/** Daily cost "as of" a date: drag the slider or press play to watch the costs of past days fall as
 *  the garments worn on them get more use (the live site's animated GIF, made interactive). */
export function DailyCostAnimation({ garments, days, range }: { garments: Garment[]; days: Day[]; range: DateRange }) {
  const { asOf, control } = useAsOf(range);
  const points = useMemo(
    () => dailyCost(garments, days, range, asOf),
    [garments, days, range, asOf],
  );
  const options = useCallback((width: number) => chartOptions(points, range, width, Y_MAX), [points, range]);

  return (
    <figure className="chart">
      {control}
      <Legend />
      <PlotFigure options={options} />
    </figure>
  );
}
