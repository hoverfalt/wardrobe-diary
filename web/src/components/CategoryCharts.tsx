// Charts over time. Design pattern (decision D-3): anything shown per category is drawn as small
// multiples, one chart per category on a shared scale, never as many coloured lines in one chart.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import { categoryImageUrl } from "../firebase";
import { categoryColor } from "../lib/categories";
import { formatFi } from "../lib/dates";
import { nextDay, type CategorySeries, type DateRange, type SeriesPoint } from "../lib/metrics";
import { PlotFigure, useDarkMode } from "./PlotFigure";

export type Format = (v: number) => string;
export const formatCount: Format = (v) => String(v);
// Formatters are created once: toLocaleString builds a new one on every call, which is slow.
const eur0 = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" });
export const formatEur: Format = (v) => eur0.format(v);
export const formatEur2: Format = (v) => eur2.format(v);

interface DayRow {
  date: Date;
  iso: string;
  /** Value per series, in the order of the series array. */
  values: number[];
}

/** One row per day of the range with each series' value, for crosshair tooltips. */
function dailyRows(series: SeriesPoint[][], range: DateRange): DayRow[] {
  const rows: DayRow[] = [];
  const idx = series.map(() => 0);
  for (let iso = range.from; iso <= range.to; iso = nextDay(iso)) {
    const values = series.map((points, i) => {
      while (idx[i] + 1 < points.length && points[idx[i] + 1].date <= iso) idx[i]++;
      return points[idx[i]].value;
    });
    rows.push({ date: utc(iso), iso, values });
  }
  return rows;
}

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toPlot = (points: SeriesPoint[]) => points.map((p) => ({ date: utc(p.date), value: p.value }));
const maxOf = (series: SeriesPoint[][]) => Math.max(1, ...series.flatMap((s) => s.map((p) => p.value)));

/** Step area + line with a crosshair tooltip: the building block of every chart over time. */
function stepChart(opts: {
  points: SeriesPoint[];
  rows: DayRow[];
  index: number;
  yMax: number;
  color: string;
  format: Format;
  width: number;
  height: number;
  ticks: number;
}): Plot.PlotOptions {
  const data = toPlot(opts.points);
  return {
    width: opts.width,
    height: opts.height,
    marginLeft: Math.max(32, opts.format(opts.yMax).length * 7),
    marginTop: 8,
    x: { type: "utc", label: null, ticks: Math.max(2, Math.floor(opts.width / 90)) },
    y: { label: null, grid: true, domain: [0, opts.yMax], nice: true, ticks: opts.ticks, tickFormat: opts.format },
    marks: [
      Plot.areaY(data, { x: "date", y: "value", curve: "step-after", fill: opts.color, fillOpacity: 0.12 }),
      Plot.line(data, { x: "date", y: "value", curve: "step-after", stroke: opts.color, strokeWidth: 1.5 }),
      Plot.ruleX(opts.rows, Plot.pointerX({ x: "date", stroke: "currentColor", strokeOpacity: 0.3 })),
      // Tooltip text is formatted only for the hovered day (`format`), not built for every day up front.
      Plot.tip(
        opts.rows,
        Plot.pointerX({
          x: { value: "date", label: "" },
          y: { value: (r: DayRow) => r.values[opts.index], label: "" },
          format: { x: (d: Date) => formatFi(d.toISOString().slice(0, 10)), y: opts.format },
        }),
      ),
    ],
  };
}

/** One small chart per category on a shared scale, with the category image and the value at the end date. */
export function CategorySmallMultiples({
  series,
  range,
  format,
}: {
  series: CategorySeries[];
  range: DateRange;
  format: Format;
}) {
  const points = useMemo(() => series.map((s) => s.points), [series]);
  const rows = useMemo(() => dailyRows(points, range), [points, range]);
  const yMax = maxOf(points);
  return (
    <div className="multiples">
      {series.map((s, i) => (
        <SmallMultiple key={s.category} series={s} rows={rows} index={i} yMax={yMax} format={format} />
      ))}
    </div>
  );
}

function SmallMultiple(props: { series: CategorySeries; rows: DayRow[]; index: number; yMax: number; format: Format }) {
  const { series, rows, index, yMax, format } = props;
  const color = categoryColor(series.category, useDarkMode());
  const img = categoryImageUrl(series.category);
  const options = useCallback(
    (width: number) =>
      stepChart({ points: series.points, rows, index, yMax, color, format, width, height: 130, ticks: 3 }),
    [series, rows, index, yMax, color, format],
  );
  return (
    <figure className="multiple">
      <figcaption>
        {img && <img className="category-image" src={img} alt="" />}
        <span>{series.category}</span>
        <span className="muted">{format(series.points[series.points.length - 1].value)}</span>
      </figcaption>
      <PlotFigure options={options} />
    </figure>
  );
}

/** A single series over time, full width (e.g. the total over all categories). */
export function TotalChart({ points, range, format }: { points: SeriesPoint[]; range: DateRange; format: Format }) {
  const rows = useMemo(() => dailyRows([points], range), [points, range]);
  const color = useDarkMode() ? "#9fb7d9" : "#3c5a80";
  const options = useCallback(
    (width: number) =>
      stepChart({ points, rows, index: 0, yMax: maxOf([points]), color, format, width, height: 300, ticks: 6 }),
    [points, rows, color, format],
  );
  if (points.length === 0) return null;
  return (
    <figure className="chart">
      <PlotFigure options={options} />
    </figure>
  );
}

export interface ScatterPoint {
  category: string;
  /** 0…1 */
  x: number;
  y: number;
}

/** One point per category, drawn as its image in a ring of the category colour (as on the live site),
 *  with a tooltip. Identity comes from the image, so colour is never the only cue. */
export function CategoryScatter({
  points,
  xLabel,
  yLabel,
  yFormat,
  yTickFormat = yFormat,
  tipLabels,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  /** Values in the tooltip. */
  yFormat: Format;
  yTickFormat?: Format;
  /** Short x and y names for the tooltip. */
  tipLabels: [string, string];
}) {
  const dark = useDarkMode();
  const options = useCallback(
    (width: number): Plot.PlotOptions => {
      const r = Math.round(Math.min(26, Math.max(14, width / 40)));
      const data = points.map((p) => ({ ...p, src: categoryImageUrl(p.category) ?? "" }));
      return {
        width,
        height: Math.min(560, Math.max(320, width * 0.6)),
        marginLeft: 56,
        marginTop: r + 8,
        marginRight: r + 8,
        marginBottom: 44,
        x: { domain: [0, 1], label: xLabel, labelAnchor: "center", labelArrow: "none", tickFormat: ".0%", grid: true },
        y: { domain: [0, Math.max(...points.map((p) => p.y), 0) * 1.08], nice: true, label: yLabel, labelArrow: "none", tickFormat: yTickFormat, grid: true },
        marks: [
          Plot.ruleY([0]),
          Plot.dot(data, { x: "x", y: "y", r: r + 3, fill: (d) => categoryColor(d.category, dark) }),
          Plot.image(data, { x: "x", y: "y", src: "src", r, preserveAspectRatio: "xMidYMid slice" }),
          Plot.tip(
            data,
            Plot.pointer({
              x: "x",
              y: "y",
              title: (d: ScatterPoint) =>
                `${d.category}\n${tipLabels[0]}: ${(d.x * 100).toFixed(0)} %\n${tipLabels[1]}: ${yFormat(d.y)}`,
            }),
          ),
        ],
      };
    },
    [points, xLabel, yLabel, yFormat, yTickFormat, tipLabels, dark],
  );
  if (points.length === 0) return null;
  return (
    <figure className="chart">
      <PlotFigure options={options} />
    </figure>
  );
}
