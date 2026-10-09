// "Active items by category" over time, in two variants to compare (ROADMAP R-09):
// A = one chart with a line per category (as on the live site), B = small multiples.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo, useState } from "react";
import { categoryImageUrl } from "../firebase";
import { categoryColor } from "../lib/categories";
import { formatFi } from "../lib/dates";
import { nextDay, type CategorySeries, type DateRange } from "../lib/metrics";
import { PlotFigure, useDarkMode } from "./PlotFigure";

interface DayRow {
  date: Date;
  iso: string;
  /** Count per series, in the order of the series array. */
  counts: number[];
}

/** One row per day of the range with each series' count, for crosshair tooltips. */
function dailyRows(series: CategorySeries[], range: DateRange): DayRow[] {
  const rows: DayRow[] = [];
  const idx = series.map(() => 0);
  for (let iso = range.from; iso <= range.to; iso = nextDay(iso)) {
    const counts = series.map((s, i) => {
      while (idx[i] + 1 < s.points.length && s.points[idx[i] + 1].date <= iso) idx[i]++;
      return s.points[idx[i]].count;
    });
    rows.push({ date: utc(iso), iso, counts });
  }
  return rows;
}

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

function flatten(series: CategorySeries[]) {
  return series.flatMap((s) => s.points.map((p) => ({ category: s.category, date: utc(p.date), count: p.count })));
}

const yMaxOf = (series: CategorySeries[]) => Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.count)));

/** A: one chart, one step line per category, with a crosshair tooltip and a hover/click legend. */
export function ActiveItemsLines({ series, range }: { series: CategorySeries[]; range: DateRange }) {
  const dark = useDarkMode();
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const focus = hovered ?? pinned;
  const rows = useMemo(() => dailyRows(series, range), [series, range]);
  const data = useMemo(() => flatten(series), [series]);
  const yMax = yMaxOf(series);

  const options = useCallback(
    (width: number): Plot.PlotOptions => ({
      width,
      height: Math.min(480, Math.max(300, width * 0.55)),
      marginLeft: 40,
      x: { type: "utc", label: null },
      y: { label: "Active items", grid: true, domain: [0, yMax], nice: true },
      marks: [
        Plot.ruleY([0]),
        Plot.line(data, {
          x: "date",
          y: "count",
          z: "category",
          curve: "step-after",
          stroke: (d) => categoryColor(d.category, dark),
          strokeWidth: (d) => (d.category === focus ? 2.5 : 1.5),
          strokeOpacity: (d) => (focus && d.category !== focus ? 0.15 : 1),
        }),
        Plot.ruleX(rows, Plot.pointerX({ x: "date", stroke: "currentColor", strokeOpacity: 0.3 })),
        Plot.tip(
          rows,
          Plot.pointerX({
            x: "date",
            y: () => yMax,
            title: (r: DayRow) =>
              [formatFi(r.iso), ...series.map((s, i) => `${s.category}: ${r.counts[i]}`)].join("\n"),
          }),
        ),
      ],
    }),
    [data, rows, series, yMax, focus, dark],
  );

  return (
    <figure className="chart">
      <ul className="legend">
        {series.map((s) => (
          <li key={s.category}>
            <button
              aria-pressed={pinned === s.category}
              className={focus && focus !== s.category ? "dim" : undefined}
              onMouseEnter={() => setHovered(s.category)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setPinned(pinned === s.category ? null : s.category)}
            >
              <span className="swatch" style={{ background: categoryColor(s.category, dark) }} />
              {s.category}
            </button>
          </li>
        ))}
      </ul>
      <PlotFigure options={options} />
    </figure>
  );
}

/** B: one small chart per category on a shared scale, with the category image and current count. */
export function ActiveItemsSmallMultiples({ series, range }: { series: CategorySeries[]; range: DateRange }) {
  const yMax = yMaxOf(series);
  const rows = useMemo(() => dailyRows(series, range), [series, range]);
  return (
    <div className="multiples">
      {series.map((s, i) => (
        <SmallMultiple key={s.category} series={s} rows={rows} index={i} yMax={yMax} />
      ))}
    </div>
  );
}

function SmallMultiple({ series, rows, index, yMax }: { series: CategorySeries; rows: DayRow[]; index: number; yMax: number }) {
  const dark = useDarkMode();
  const color = categoryColor(series.category, dark);
  const img = categoryImageUrl(series.category);
  const data = useMemo(() => flatten([series]), [series]);
  const options = useCallback(
    (width: number): Plot.PlotOptions => ({
      width,
      height: 130,
      marginLeft: 32,
      marginTop: 8,
      x: { type: "utc", label: null, ticks: Math.max(2, Math.floor(width / 90)) },
      y: { label: null, grid: true, domain: [0, yMax], nice: true, ticks: 3 },
      marks: [
        Plot.areaY(data, { x: "date", y: "count", curve: "step-after", fill: color, fillOpacity: 0.12 }),
        Plot.line(data, { x: "date", y: "count", curve: "step-after", stroke: color, strokeWidth: 1.5 }),
        Plot.ruleX(rows, Plot.pointerX({ x: "date", stroke: "currentColor", strokeOpacity: 0.3 })),
        Plot.tip(
          rows,
          Plot.pointerX({
            x: "date",
            y: (r: DayRow) => r.counts[index],
            title: (r: DayRow) => `${formatFi(r.iso)}: ${r.counts[index]}`,
          }),
        ),
      ],
    }),
    [data, rows, index, yMax, color],
  );
  const current = series.points[series.points.length - 1].count;
  return (
    <figure className="multiple">
      <figcaption>
        {img && <img className="category-image" src={img} alt="" />}
        <span>{series.category}</span>
        <span className="muted">{current}</span>
      </figcaption>
      <PlotFigure options={options} />
    </figure>
  );
}
