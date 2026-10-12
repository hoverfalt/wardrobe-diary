// Daily logging (R-13/R-15, owner only): the app is the source of truth for wears since 2026-10-09.
// Mobile-first: day navigation, the day's outfit on top, search, and the garments worn most in the last
// 60 days first in each category. Works offline (the SDK queues writes).
import { TAG_IDS, TAGS, tagSearchText } from "../lib/tags";
import { useEffect, useMemo, useState } from "react";
import { setDayWorn, usePendingWrites } from "../data/repo";
import { photoUrl } from "../firebase";
import { compareCategories } from "../lib/categories";
import { addDays, todayIso } from "../lib/dates";
import { dayLabel, nextTagState, passesTagFilter, recentWears, toggleWorn, type TagFilter } from "../lib/logging";
import { isActive } from "../lib/metrics";
import type { Wardrobe } from "../lib/publicData";
import type { Garment } from "../types";

export function LogDay({ uid, wardrobe }: { uid: string; wardrobe: Wardrobe | null }) {
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useStoredTagFilter();
  const [error, setError] = useState("");
  const pending = usePendingWrites(uid);
  const online = useOnline();

  const wornIds = useMemo(() => wardrobe?.days.find((d) => d.date === date)?.worn ?? [], [wardrobe, date]);
  const worn = useMemo(() => new Set(wornIds), [wornIds]);
  const byId = useMemo(() => new Map((wardrobe?.garments ?? []).map((g) => [g.id, g])), [wardrobe]);

  const byCategory = useMemo(() => {
    if (!wardrobe) return { categories: [], hidden: 0 };
    const recent = recentWears(wardrobe.days, date);
    const q = search.trim().toLowerCase();
    const map = new Map<string, Garment[]>();
    let hidden = 0;
    for (const g of wardrobe.garments) {
      if (!isActive(g, date) && !worn.has(g.id)) continue;
      // Tag toggles narrow the list; garments worn that day always stay, so they can be unticked.
      if (!worn.has(g.id) && !passesTagFilter(g, tagFilter)) {
        hidden++;
        continue;
      }
      // Tags count too, so "motorcycle" or "bike" lists that gear.
      if (q && !`${g.item} ${g.details} ${tagSearchText(g)}`.toLowerCase().includes(q)) continue;
      map.set(g.category, [...(map.get(g.category) ?? []), g]);
    }
    for (const items of map.values())
      items.sort((a, b) => (recent.get(b.id) ?? 0) - (recent.get(a.id) ?? 0) || a.item.localeCompare(b.item));
    return { categories: [...map.entries()].sort(([a], [b]) => compareCategories(a, b)), hidden };
  }, [wardrobe, date, search, worn, tagFilter]);

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
            const src = photoUrl(g);
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

      <div className="tag-toggles" role="group" aria-label="Tag filters">
        {TAG_IDS.map((t) => {
          const state = tagFilter[t];
          return (
            <button
              key={t}
              className={`tag-toggle ${state ?? ""}`}
              onClick={() => setTagFilter({ ...tagFilter, [t]: nextTagState(state) })}
              title={state === "include" ? "Showing only garments with this tag (or another green one). Tap to hide them." : state === "exclude" ? "Hiding garments with this tag. Tap to reset." : "Tap to show only garments with this tag."}
            >
              <span aria-hidden="true">{state === "include" ? "✓ " : state === "exclude" ? "✕ " : ""}</span>
              {TAGS[t].label}
              <span className="sr-only">{state === "include" ? " (only)" : state === "exclude" ? " (hidden)" : ""}</span>
            </button>
          );
        })}
        {byCategory.hidden > 0 && (
          <span className="muted">
            {byCategory.hidden} hidden · <button className="link" onClick={() => setTagFilter({})}>Clear</button>
          </span>
        )}
      </div>

      <input type="search" className="log-search" placeholder="Search garments" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search garments" />

      {byCategory.categories.map(([category, items]) => (
        <div key={category}>
          <h3>{category}</h3>
          <div className="grid">
            {items.map((g) => {
              const on = worn.has(g.id);
              const src = photoUrl(g);
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

const TAG_FILTER_KEY = "wardrobe-diary:log-tag-filter";

/** The Log page's tag toggles, kept in this browser between sessions (a per-device convenience). */
function useStoredTagFilter(): [TagFilter, (f: TagFilter) => void] {
  const [filter, setFilter] = useState<TagFilter>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(TAG_FILTER_KEY) ?? "{}");
      // Keep only known tags and states (the vocabulary may change).
      return Object.fromEntries(
        Object.entries(stored).filter(([t, s]) => (TAG_IDS as string[]).includes(t) && (s === "include" || s === "exclude")),
      ) as TagFilter;
    } catch {
      return {};
    }
  });
  const save = (next: TagFilter) => {
    const clean = Object.fromEntries(Object.entries(next).filter(([, s]) => s)) as TagFilter;
    setFilter(clean);
    try {
      localStorage.setItem(TAG_FILTER_KEY, JSON.stringify(clean));
    } catch {
      // Storage unavailable (e.g. private browsing): the toggles still work for this visit.
    }
  };
  return [filter, save];
}
