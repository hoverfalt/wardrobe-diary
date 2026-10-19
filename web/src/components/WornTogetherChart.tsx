// Worn together (R-45): every garment worn in the range sits on a ring, grouped into category arcs in the standard
// order (most worn first within a category). Lines join the chosen category's garments (or one chosen garment) to
// the garments worn on the same days; a line's strength shows how many days. Hover a garment to see only its lines;
// tap or click it to choose it. The list under the ring names the most frequent companions (also the accessible view).
import { memo, useMemo, useRef, useState } from "react";
import { photoUrl } from "../firebase";
import { compareCategories, categoryColor } from "../lib/categories";
import { companions, wornTogether, type WornTogether } from "../lib/combinations";
import type { DateRange } from "../lib/metrics";
import type { Day, Garment } from "../types";
import { Link } from "./Link";
import { useDarkMode, useWidth } from "./PlotFigure";
import { TagBadges } from "./TagBadges";

const GAP = 0.03; // radians between category arcs
const BAND = 12; // ring thickness, px
const LIST = 12;

interface Slot { g: Garment; a0: number; a1: number; mid: number }
interface Edge { a: string; b: string; n: number }

const point = (angle: number, r: number) => [Math.sin(angle) * r, -Math.cos(angle) * r] as const;
function sector(a0: number, a1: number, r0: number, r1: number): string {
  const [x0, y0] = point(a0, r1), [x1, y1] = point(a1, r1), [x2, y2] = point(a1, r0), [x3, y3] = point(a0, r0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}
/** A curve between two points on the inner circle, bent towards the centre (a simple edge bundle). */
function curve(a: number, b: number, r: number): string {
  const [x0, y0] = point(a, r), [x1, y1] = point(b, r);
  return `M${x0},${y0}Q${((x0 + x1) / 2) * 0.2},${((y0 + y1) / 2) * 0.2} ${x1},${y1}`;
}
// Linear in days, so the many rare combinations stay faint and the frequent ones stand out (as in the R chord chart).
const opacity = (n: number, max: number) => Math.min(0.9, 0.035 + 0.865 * (n / max));
const sharePct = (v: number) => (v > 0 && v < 0.01 ? "<1" : String(Math.round(v * 100)));

/** Category labels outside the ring, pushed apart vertically on each side so small neighbouring arcs don't overlap. */
function placeLabels(items: { c: string; angle: number }[], r: number, gap = 15) {
  const placed = items.map(({ c, angle }) => { const [x, y] = point(angle, r); return { c, x, y }; });
  for (const right of [true, false]) {
    const side = placed.filter((p) => (p.x >= 0) === right).sort((a, b) => a.y - b.y);
    for (let i = 1; i < side.length; i++) if (side[i].y - side[i - 1].y < gap) side[i].y = side[i - 1].y + gap;
  }
  return new Map(placed.map((p) => [p.c, p]));
}

const Lines = memo(function Lines({ edges, slots, r, color, dim }: { edges: Edge[]; slots: Map<string, Slot>; r: number; color: string; dim?: boolean }) {
  const max = Math.max(1, ...edges.map((e) => e.n));
  return (
    <g fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" opacity={dim ? 0.2 : 1} pointerEvents="none">
      {edges.map((e) => (
        <path key={`${e.a}|${e.b}`} d={curve(slots.get(e.a)!.mid, slots.get(e.b)!.mid, r)} strokeOpacity={opacity(e.n, max)} />
      ))}
    </g>
  );
});

function edgesOf(ids: Set<string>, wt: WornTogether, slots: Map<string, Slot>): Edge[] {
  const edges: Edge[] = [];
  for (const a of ids)
    for (const [b, n] of wt.pairs.get(a) ?? [])
      if (slots.has(b) && (!ids.has(b) || a < b)) edges.push({ a, b, n });
  return edges.sort((x, y) => x.n - y.n); // strongest drawn last, on top
}

export function WornTogetherChart({ garments, days, range }: { garments: Garment[]; days: Day[]; range: DateRange }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const dark = useDarkMode();
  const wt = useMemo(() => wornTogether(garments, days, range), [garments, days, range]);
  const byId = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments]);

  // Garments worn in the range, by category (standard order), most worn first.
  const groups = useMemo(() => {
    const map = new Map<string, Garment[]>();
    for (const g of garments) if (wt.wears.has(g.id)) map.set(g.category, [...(map.get(g.category) ?? []), g]);
    return [...map]
      .sort(([a], [b]) => compareCategories(a, b))
      .map(([category, list]) => ({ category, list: list.sort((a, b) => wt.wears.get(b.id)! - wt.wears.get(a.id)! || a.item.localeCompare(b.item)) }));
  }, [garments, wt]);
  const slots = useMemo(() => {
    const n = groups.reduce((s, x) => s + x.list.length, 0);
    const step = (2 * Math.PI - GAP * groups.length) / Math.max(1, n);
    const map = new Map<string, Slot>();
    let a = GAP / 2;
    for (const { list } of groups) {
      for (const g of list) {
        map.set(g.id, { g, a0: a, a1: a + step, mid: a + step / 2 });
        a += step;
      }
      a += GAP;
    }
    return map;
  }, [groups]);

  const [focus, setFocus] = useState("Jackets and hoodies");
  const [chosen, setChosen] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const category = groups.find((x) => x.category === focus) ?? groups[0];
  const chosenGarment = chosen && slots.has(chosen) ? byId.get(chosen)! : null;
  const subject = useMemo(
    () => new Set(chosenGarment ? [chosenGarment.id] : (category?.list ?? []).map((g) => g.id)),
    [chosenGarment, category],
  );
  const subjectColor = categoryColor(chosenGarment?.category ?? category?.category ?? "", dark);
  const list = useMemo(() => companions(subject, garments, days, range), [subject, garments, days, range]);
  const together = useMemo(() => new Map(list.companions.map((c) => [c.id, c.days])), [list]);
  // One garment: all its lines. A category: one line per companion (all its lines would fill the circle), as strong
  // as the days worn with the category and ending at the category's garment it is most often worn with.
  const edges = useMemo(() => {
    if (chosenGarment) return edgesOf(subject, wt, slots);
    return list.companions
      .filter((c) => slots.has(c.id))
      .map((c): Edge => {
        let best = "", most = -1;
        for (const [a, n] of wt.pairs.get(c.id) ?? []) if (subject.has(a) && n > most) [best, most] = [a, n];
        return { a: best, b: c.id, n: c.days };
      })
      .sort((x, y) => x.n - y.n);
  }, [chosenGarment, subject, wt, slots, list]);
  const hovered = hover && hover.id !== chosen ? hover.id : null;
  const hoverEdges = useMemo(() => (hovered ? edgesOf(new Set([hovered]), wt, slots) : []), [hovered, wt, slots]);

  const wide = width >= 560;
  const size = Math.min(width, 760);
  const R = Math.max(80, Math.min(width / 2 - (wide ? 140 : 6), size / 2 - (wide ? 24 : 6)));
  const height = 2 * R + (wide ? 48 : 12);
  const inner = R - BAND - 3;
  const subjectName = chosenGarment ? chosenGarment.item : category?.category;
  const choose = (id: string | null) => {
    setChosen(id === chosen ? null : id);
    setHover(null);
  };

  const labels = placeLabels(groups.map(({ category: c, list: l }) => ({ c, angle: (slots.get(l[0].id)!.a0 + slots.get(l[l.length - 1].id)!.a1) / 2 })), R + 8);
  if (groups.length === 0) return <p className="muted">No wears logged in this date range.</p>;
  const hoverGarment = hover ? byId.get(hover.id) : null;
  return (
    <div className="worn-together">
      <div className="wt-categories" role="group" aria-label="Category">
        {groups.map(({ category: c }) => (
          <button key={c} aria-pressed={!chosenGarment && c === category.category} onClick={() => { setFocus(c); setChosen(null); }}>
            <span className="swatch" style={{ background: categoryColor(c, dark) }} />
            {c}
          </button>
        ))}
      </div>
      <div ref={box} className="wt-chart" onPointerLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`} onClick={() => chosen && choose(null)}>
            {groups.map(({ category: c, list: l }) => {
              const a0 = slots.get(l[0].id)!.a0, a1 = slots.get(l[l.length - 1].id)!.a1;
              const active = chosenGarment ? chosenGarment.category === c : c === category.category;
              const { x: lx, y: ly } = labels.get(c)!;
              return (
                <g key={c}>
                  <path d={sector(a0, a1, R - BAND, R)} fill={categoryColor(c, dark)} opacity={active ? 1 : 0.45} />
                  {wide && (
                    <text x={lx} y={ly} dy="0.35em" textAnchor={Math.abs(lx) < 20 ? "middle" : lx > 0 ? "start" : "end"} className="wt-label" fontWeight={active ? 700 : 400}>
                      {c}
                    </text>
                  )}
                </g>
              );
            })}
            <Lines edges={edges} slots={slots} r={inner} color={subjectColor} dim={hoverEdges.length > 0} />
            {hovered && <Lines edges={hoverEdges} slots={slots} r={inner} color={categoryColor(byId.get(hovered)!.category, dark)} />}
            {[chosen, hover?.id].map((id, i) => id && slots.has(id) && (
              <path key={i} d={sector(slots.get(id)!.a0 - 0.004, slots.get(id)!.a1 + 0.004, R - BAND - 2, R + 3)} fill="var(--fg)" pointerEvents="none" />
            ))}
            {[...slots.values()].map((s) => (
              <path
                key={s.g.id}
                d={sector(s.a0, s.a1, inner - 18, R + 6)}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onPointerEnter={(e) => {
                  const r = box.current!.getBoundingClientRect();
                  setHover({ id: s.g.id, x: e.clientX - r.left, y: e.clientY - r.top });
                }}
                onClick={(e) => { e.stopPropagation(); choose(s.g.id); }}
              />
            ))}
          </svg>
        )}
        {hover && hoverGarment && (
          <div className="wt-tip" style={{ left: Math.min(hover.x + 12, width - 230), top: hover.y + 12 }}>
            {photoUrl(hoverGarment) && <img src={photoUrl(hoverGarment)!} alt="" className={hoverGarment.divested ? "divested" : undefined} />}
            <div>
              <strong>{hoverGarment.item}</strong> <TagBadges garment={hoverGarment} />
              <span className="muted">{hoverGarment.category}</span>
              <span>Worn {wt.wears.get(hoverGarment.id)} days</span>
              {!subject.has(hoverGarment.id) && <span>With {subjectName}: {together.get(hoverGarment.id) ?? 0} days</span>}
            </div>
          </div>
        )}
      </div>
      <div className="wt-list">
        <p>
          {chosenGarment ? (
            <>
              <Link to={{ page: "garment", id: chosenGarment.id }}>{chosenGarment.item}</Link>: worn {list.subjectDays} days in the
              range. Most often worn with (<button className="link-button" onClick={() => choose(null)}>back to {category.category}</button>):
            </>
          ) : (
            <>{category.category}: worn {list.subjectDays} days in the range. Most often worn with:</>
          )}
        </p>
        <ol className="wt-companions">
          {list.companions.slice(0, LIST).map((c) => {
            const g = byId.get(c.id)!;
            return (
              <li key={c.id}>
                <button onClick={() => choose(c.id)} title={`Show what ${g.item} is worn with`}>
                  {photoUrl(g) && <img src={photoUrl(g)!} alt="" className={g.divested ? "divested" : undefined} />}
                  <span className="name">{g.item} <TagBadges garment={g} /></span>
                  <span className="muted">
                    <span className="swatch" style={{ background: categoryColor(g.category, dark) }} />
                    {c.days} days · {sharePct(c.shareOfItsWears)} % of its wears
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
