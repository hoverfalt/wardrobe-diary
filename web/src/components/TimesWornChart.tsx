// "Times worn" for a category page (R: setup_category_times_used_plot): one bar per item ending in its
// photo, divested items (green ring) below active ones, each group with newer items higher. Shaded bands
// show how many times divested items were worn: middle 36 % (32nd–68th percentile, ≈ ±1 SD) and middle
// 90 % (5th–95th, ≈ ±2 SD). Unlike the live site, every item gets its own row, so photos don't overlap.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import { photoUrl } from "../firebase";
import { quantile, type ItemRow } from "../lib/metrics";
import { PlotFigure } from "./PlotFigure";

const DIVESTED = "#3CB371"; // live site: mediumseagreen
const ROW = 28;
const FI = new Intl.NumberFormat("fi-FI");

export function timesWornOrder(rows: ItemRow[]): ItemRow[] {
  // Top to bottom: active items, newest first; then divested items, shortest-owned first (as in R).
  const byOwned = (a: ItemRow, b: ItemRow) => a.monthsOwned - b.monthsOwned;
  return [...rows.filter((r) => r.active).sort(byOwned), ...rows.filter((r) => !r.active).sort(byOwned)];
}

export function divestedBands(rows: ItemRow[]) {
  const worn = rows.filter((r) => !r.active).map((r) => r.timesWorn);
  const q = (p: number) => quantile(worn, p);
  return worn.length === 0
    ? []
    : [
        { x1: q(0.05)!, x2: q(0.95)!, label: "middle 90 %" },
        { x1: q(0.32)!, x2: q(0.68)!, label: "middle 36 %" },
      ];
}

export function TimesWornChart({ rows, minRows = 0, xMax }: {
  rows: ItemRow[];
  /** Keep at least this many rows of height (stops the animation from resizing as items appear). */
  minRows?: number;
  /** Fixed scale maximum (the animation keeps the final scale). */
  xMax?: number;
}) {
  const ordered = useMemo(() => timesWornOrder(rows), [rows]);
  const bands = useMemo(() => divestedBands(rows), [rows]);
  const options = useCallback(
    (width: number): Plot.PlotOptions => {
      const names = width >= 640;
      const data = ordered.map((r) => ({
        ...r,
        id: r.garment.id,
        name: r.garment.item,
        src: photoUrl(r.garment.photo) ?? "",
      }));
      const r = ROW / 2 - 2;
      // Outer band (90 %) labels on the upper line, inner band (36 %) labels below, so they can't collide.
      const labels = bands.flatMap((b, i) => [b.x1, b.x2].map((v) => ({ v, text: String(Math.round(v)), dy: i === 0 ? -22 : -8 })));
      return {
        width,
        height: Math.max(data.length, minRows) * ROW + 70,
        marginLeft: names ? 220 : 8,
        marginRight: r + 12,
        marginTop: 34,
        x: {
          label: "Times worn",
          labelAnchor: "right",
          grid: true,
          nice: true,
          domain: [0, xMax ?? Math.max(1, ...data.map((d) => d.timesWorn))],
          tickFormat: (v: number) => FI.format(v),
        },
        y: {
          domain: data.map((d) => d.id),
          // Fixed row height: in the animation, rows keep their spacing and free space stays below.
          range: [34, 34 + data.length * ROW],
          label: null,
          axis: names ? "left" : null,
          tickFormat: (id: string) => {
            const name = data.find((d) => d.id === id)?.name ?? "";
            return name.length > 32 ? `${name.slice(0, 31)}…` : name;
          },
          tickSize: 0,
        },
        marks: [
          Plot.rectX(bands, { x1: "x1", x2: "x2", fill: DIVESTED, fillOpacity: 0.12 }),
          Plot.text(labels.filter((l) => l.dy === -22), { x: "v", text: "text", frameAnchor: "top", dy: -22, fill: DIVESTED, fontWeight: 600 }),
          Plot.text(labels.filter((l) => l.dy === -8), { x: "v", text: "text", frameAnchor: "top", dy: -8, fill: DIVESTED, fontWeight: 600 }),
          Plot.ruleY(data, {
            y: "id",
            x1: 0,
            x2: "timesWorn",
            stroke: (d) => (d.active ? "currentColor" : DIVESTED),
            strokeOpacity: (d) => (d.active ? 0.25 : 0.7),
            strokeWidth: 3,
          }),
          Plot.dot(data.filter((d) => !d.active), { x: "timesWorn", y: "id", r: r + 2.5, fill: DIVESTED }),
          Plot.image(data, { x: "timesWorn", y: "id", src: "src", r, preserveAspectRatio: "xMidYMid slice" }),
          Plot.tip(
            data,
            Plot.pointerY({
              x: "timesWorn",
              y: "id",
              title: (d: (typeof data)[number]) =>
                `${d.name}\nTimes worn: ${d.timesWorn}\n${d.active ? "Active" : "Divested"}`,
            }),
          ),
        ],
      };
    },
    [ordered, bands, minRows, xMax],
  );
  if (rows.length === 0) return null;
  return (
    <figure className="chart">
      {bands.length > 0 && (
        <ul className="chart-legend" aria-label="Legend">
          <li><span className="dot" style={{ background: DIVESTED }} /> Divested</li>
          <li><span className="dot" style={{ background: "var(--bar-grey)" }} /> Active</li>
          <li>
            <span className="box" style={{ background: "rgba(60, 179, 113, 0.25)" }} /> How often divested items
            were worn: middle 90 % ({Math.round(bands[0].x1)}–{Math.round(bands[0].x2)}) and middle 36 % (
            {Math.round(bands[1].x1)}–{Math.round(bands[1].x2)})
          </li>
        </ul>
      )}
      <PlotFigure options={options} />
    </figure>
  );
}
