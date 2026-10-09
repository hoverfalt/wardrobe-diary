// Daily logging (R-13/R-15, owner only): the app is the source of truth for wears since 2026-10-09.
// Mobile-first: day navigation, the day's outfit on top, search, and the garments worn most in the last
// 60 days first in each category. Works offline (the SDK queues writes).
import { useEffect, useMemo, useState } from "react";
import { setDayWorn, usePendingWrites } from "../data/repo";
import { photoUrl } from "../firebase";
import { compareCategories } from "../lib/categories";
import { addDays, todayIso } from "../lib/dates";
import { dayLabel, recentWears, toggleWorn } from "../lib/logging";
import { isActive } from "../lib/metrics";
import type { Wardrobe } from "../lib/publicData";
import type { Garment } from "../types";

export function LogDay({ uid, wardrobe }: { uid: string; wardrobe: Wardrobe | null }) {
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const pending = usePendingWrites(uid);
  const online = useOnline();

  const wornIds = useMemo(() => wardrobe?.days.find((d) => d.date === date)?.worn ?? [], [wardrobe, date]);
  const worn = useMemo(() => new Set(wornIds), [wornIds]);
  const byId = useMemo(() => new Map((wardrobe?.garments ?? []).map((g) => [g.id, g])), [wardrobe]);

  const byCategory = useMemo(() => {
    if (!wardrobe) return [];
    const recent = recentWears(wardrobe.days, date);
    const q = search.trim().toLowerCase();
    const map = new Map<string, Garment[]>();
    for (const g of wardrobe.garments) {
      if (!isActive(g, date) && !worn.has(g.id)) continue;
      if (q && !`${g.item} ${g.details}`.toLowerCase().includes(q)) continue;
      map.set(g.category, [...(map.get(g.category) ?? []), g]);
    }
    for (const items of map.values())
      items.sort((a, b) => (recent.get(b.id) ?? 0) - (recent.get(a.id) ?? 0) || a.item.localeCompare(b.item));
    return [...map.entries()].sort(([a], [b]) => compareCategories(a, b));
  }, [wardrobe, date, search, worn]);

  if (!wardrobe) return <p>Loading…</p>;

  const toggle = (id: string, on: boolean) => {
    const { ids, indexes } = toggleWorn(wardrobe.garments, wornIds, id, on);
    setError("");
    setDayWorn(uid, date, ids, indexes).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  return (
    <section className="log">
      <div className="log-day">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
        <h2>{dayLabel(date, today)}</h2>
        <button onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day">›</button>
        <input type="date" value={date} max={today} onChange={(e) => e.target.value && e.target.value <= today && setDate(e.target.value)} aria-label="Date" />
        {date !== today && <button onClick={() => setDate(today)}>Today</button>}
      </div>

      <div className="log-outfit">
        <strong>{worn.size} {worn.size === 1 ? "item" : "items"} worn</strong>
        <span className={pending ? "muted" : "ok"}>
          {error ? <span className="error">Not saved: {error}</span> : pending ? (online ? "Saving…" : "Saved on this device; will sync when online") : "All changes saved"}
        </span>
        <div className="chips">
          {wornIds.map((id) => {
            const g = byId.get(id);
            if (!g) return null;
            const src = photoUrl(g.photo);
            return (
              <button key={id} className="chip" onClick={() => toggle(id, false)} aria-label={`Remove ${g.item}`}>
                {src && <img src={src} alt="" />}
                <span>{g.item}</span>
                <span aria-hidden="true">×</span>
              </button>
            );
          })}
        </div>
      </div>

      <input type="search" className="log-search" placeholder="Search garments" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search garments" />

      {byCategory.map(([category, items]) => (
        <div key={category}>
          <h3>{category}</h3>
          <div className="grid">
            {items.map((g) => {
              const on = worn.has(g.id);
              const src = photoUrl(g.photo);
              return (
                <button key={g.id} className={on ? "tile on" : "tile"} aria-pressed={on} onClick={() => toggle(g.id, !on)}>
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

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
