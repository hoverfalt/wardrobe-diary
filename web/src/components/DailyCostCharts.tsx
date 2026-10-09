// "Daily cost" (R: calculate_daily_cost / setup_daily_cost_plot) and its animated version, where an
// "as of" date replays how the daily costs looked when only the wears up to that date were known.
import * as Plot from "@observablehq/plot";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, dayIndex, formatFi } from "../lib/dates";
import { dailyCost, type DailyCostPoint, type DateRange } from "../lib/metrics";
import type { Day, Garment } from "../types";
import { formatEur2 } from "./CategoryCharts";
import { PlotFigure } from "./PlotFigure";

// As on the live site: a fixed 0–40 € scale (so the animation doesn't jump), summers shaded.
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

function chartOptions(points: DailyCostPoint[], range: DateRange, width: number): Plot.PlotOptions {
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
    y: { domain: [0, Y_MAX], label: null, grid: true, tickFormat: (v: number) => `${v} €` },
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

function Clipped({ points }: { points: DailyCostPoint[] }) {
  const n = points.filter((p) => p.cost > Y_MAX).length;
  return n > 0 ? (
    <p className="muted">
      {n} {n === 1 ? "day" : "days"} above {Y_MAX} € not shown (the scale is fixed at {Y_MAX} €, as on wardrobediary.io).
    </p>
  ) : null;
}

/** Daily cost over the range, with lifetime cost per wear (D-2). */
export function DailyCostChart({ garments, days, range }: { garments: Garment[]; days: Day[]; range: DateRange }) {
  const points = useMemo(() => dailyCost(garments, days, range), [garments, days, range]);
  const options = useCallback((width: number) => chartOptions(points, range, width), [points, range]);
  return (
    <figure className="chart">
      <Legend />
      <PlotFigure options={options} />
      <Clipped points={points} />
    </figure>
  );
}

const STEP_DAYS = 7;
const FRAME_MS = 60;

/** Daily cost "as of" a date: drag the slider or press play to watch the costs of past days fall as
 *  the garments worn on them get more use (the live site's animated GIF, made interactive). */
export function DailyCostAnimation({ garments, days, range }: { garments: Garment[]; days: Day[]; range: DateRange }) {
  const span = Math.max(0, dayIndex(range.from, range.to));
  const [step, setStep] = useState(span);
  const [playing, setPlaying] = useState(false);
  const at = Math.min(step, span);
  const asOf = addDays(range.from, at);

  useEffect(() => setStep((s) => Math.min(s, span)), [span]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setStep((s) => {
        if (s >= span) {
          setPlaying(false);
          return span;
        }
        return Math.min(span, s + STEP_DAYS);
      });
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [playing, span]);

  const points = useMemo(
    () => dailyCost(garments, days, range, asOf),
    [garments, days, range, asOf],
  );
  const options = useCallback((width: number) => chartOptions(points, range, width), [points, range]);

  return (
    <figure className="chart">
      <div className="as-of">
        <button
          onClick={() => {
            if (!playing && at >= span) setStep(0);
            setPlaying(!playing);
          }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <label>
          As of <strong>{formatFi(asOf)}</strong>
          <input type="range" min={0} max={span} value={at} aria-valuetext={formatFi(asOf)}
            onChange={(e) => {
              setPlaying(false);
              setStep(Number(e.target.value));
            }} />
        </label>
      </div>
      <Legend />
      <PlotFigure options={options} />
    </figure>
  );
}
