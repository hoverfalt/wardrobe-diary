import { useMemo, useState } from "react";
import { setWorn, useDays, useGarments } from "../data/repo";
import { photoUrl } from "../firebase";
import { formatFi, todayIso } from "../lib/dates";
import { isActive } from "../lib/metrics";
import type { Garment } from "../types";

export function LogDay({ uid }: { uid: string }) {
  const [date, setDate] = useState(todayIso());
  const garments = useGarments(uid);
  const days = useDays(uid);

  const worn = useMemo(() => new Set(days?.find((d) => d.date === date)?.worn ?? []), [days, date]);
  const byCategory = useMemo(() => {
    const map = new Map<string, Garment[]>();
    for (const g of garments ?? []) {
      if (!isActive(g, date)) continue;
      map.set(g.category, [...(map.get(g.category) ?? []), g]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [garments, date]);

  if (!garments || !days) return <p>Loading…</p>;

  return (
    <section>
      <h2>
        Log {formatFi(date)}{" "}
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </h2>
      <p className="muted">{worn.size} items worn</p>
      {byCategory.map(([category, items]) => (
        <div key={category}>
          <h3>{category}</h3>
          <div className="grid">
            {items.map((g) => {
              const on = worn.has(g.id);
              const src = photoUrl(g.photo);
              return (
                <button
                  key={g.id}
                  className={on ? "tile on" : "tile"}
                  aria-pressed={on}
                  onClick={() => setWorn(uid, date, g.id, !on)}
                >
                  {src && <img src={src} alt="" loading="lazy" />}
                  <span>{g.item}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
