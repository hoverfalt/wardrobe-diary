// Daily logging (R-13/R-15, owner only): the app is the source of truth for wears since 2026-10-09.
// Mobile-first: day navigation, the day's outfit on top, search, and the garments worn most in the last
// 60 days first in each category. Works offline (the SDK queues writes).
import { TAG_IDS, TAGS, tagSearchText } from "../lib/tags";
import { useEffect, useMemo, useRef, useState } from "react";
import { setDayWorn, usePendingWrites, useRotationSeries } from "../data/repo";
import { photoUrl } from "../firebase";
import { compareCategories } from "../lib/categories";
import { addDays, todayIso } from "../lib/dates";
import { dayLabel, nextTagState, passesTagFilter, recentWears, toggleWorn, type TagFilter } from "../lib/logging";
import { isActive, wearIndex } from "../lib/metrics";
import { logEntries, rotationRanks, seriesOf, type LogEntry } from "../lib/rotation";
import { VoiceFind } from "../components/VoiceFind";
import type { Wardrobe } from "../lib/publicData";
import type { Garment } from "../types";

export function LogDay({ uid, wardrobe }: { uid: string; wardrobe: Wardrobe | null }) {
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [tagFilter, setTagFilter] = useStoredTagFilter();
  const [error, setError] = useState("");
  const pending = usePendingWrites(uid);
  const online = useOnline();

  const wornIds = useMemo(() => wardrobe?.days.find((d) => d.date === date)?.worn ?? [], [wardrobe, date]);
  const worn = useMemo(() => new Set(wornIds), [wornIds]);
  const byId = useMemo(() => new Map((wardrobe?.garments ?? []).map((g) => [g.id, g])), [wardrobe]);
  const rotationKeys = useRotationSeries(uid);
  const marked = useMemo(() => new Set(rotationKeys), [rotationKeys]);
  const wears = useMemo(() => wearIndex(wardrobe?.days ?? []), [wardrobe]);

  const byCategory = useMemo(() => {
    if (!wardrobe) return { categories: [], hidden: 0 };
    const recent = recentWears(wardrobe.days, date);
    const q = search.trim().toLowerCase();
    const listed: Garment[] = [];
    let hidden = 0;
    for (const g of wardrobe.garments) {
      if (!isActive(g, date) && !worn.has(g.id)) continue;
      // Tag toggles narrow the list; garments worn that day always stay, so they can be unticked.
      if (!worn.has(g.id) && !passesTagFilter(g, tagFilter)) {
        hidden++;
        continue;
      }
      listed.push(g);
    }
    // Tags count too, so "motorcycle" or "bike" lists that gear.
    const matches = (g: Garment) => !q || `${g.item} ${g.details} ${tagSearchText(g)}`.toLowerCase().includes(q);
    const map = new Map<string, LogEntry[]>();
    for (const e of logEntries(listed, matches, worn, marked, wears)) {
      const category = e.kind === "garment" ? e.garment.category : e.members[0].category;
      map.set(category, [...(map.get(category) ?? []), e]);
    }
    // A series counts its garments' recent wears together.
    const recentOf = (e: LogEntry) => (e.kind === "garment" ? recent.get(e.garment.id) ?? 0 : e.members.reduce((n, m) => n + (recent.get(m.id) ?? 0), 0));
    const nameOf = (e: LogEntry) => (e.kind === "garment" ? e.garment.item : e.name);
    for (const items of map.values()) items.sort((a, b) => recentOf(b) - recentOf(a) || nameOf(a).localeCompare(nameOf(b)));
    return { categories: [...map.entries()].sort(([a], [b]) => compareCategories(a, b)), hidden };
  }, [wardrobe, date, search, worn, tagFilter, marked, wears]);

  // Garments the "Describe an item" field can propose: active on the day, not yet logged, within the filters.
  const voiceCandidates = useMemo(
    () => (wardrobe ? wardrobe.garments.filter((g) => isActive(g, date) && !worn.has(g.id) && passesTagFilter(g, tagFilter)) : []),
    [wardrobe, date, worn, tagFilter],
  );
  const recent = useMemo(() => (wardrobe ? recentWears(wardrobe.days, date) : new Map<string, number>()), [wardrobe, date]);
  // Marked series: the field proposes the next in line, as the series tile does.
  const rotation = useMemo(() => rotationRanks(voiceCandidates, marked, wears), [voiceCandidates, marked, wears]);

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
        <TagFilterMenu filter={tagFilter} onChange={setTagFilter} hidden={byCategory.hidden} />
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

      <VoiceFind uid={uid} date={date} candidates={voiceCandidates} days={wardrobe.days} recent={recent} rotation={rotation} onAdd={(id) => toggle(id, true)} />

      <div className="log-search">
        <input ref={searchRef} type="search" placeholder="Search garments" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search garments" />
        {/* Clears the box and keeps the keyboard up for the next garment (handy on a phone). */}
        <button type="button" onClick={() => { setSearch(""); searchRef.current?.focus(); }}>Clear</button>
      </div>

      {byCategory.categories.map(([category, items]) => (
        <div key={category}>
          <h3>{category}</h3>
          <div className="grid">
            {items.map((e) => {
              if (e.kind === "series") {
                // One tile for a marked series: logs the next in line, or removes the one worn that day.
                const shown = e.worn ?? e.next;
                const src = shown && photoUrl(shown);
                const number = (x: Garment | null) => (x && seriesOf(x)?.number) ?? "";
                return (
                  <button
                    key={e.key}
                    className={e.worn ? "tile on" : "tile"}
                    aria-pressed={!!e.worn}
                    disabled={!e.worn && !e.next}
                    onClick={() => (e.worn ? toggle(e.worn.id, false) : e.next && toggle(e.next.id, true))}
                  >
                    {src && <img src={src} alt="" loading="lazy" />}
                    <span>{e.name}</span>
                    <small className="muted">{e.worn ? `${number(e.worn)} worn` : `next: ${number(e.next)}`} · {e.members.length} in rotation</small>
                  </button>
                );
              }
              const g = e.garment;
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

/** "Filters" button with a popup of tag toggles (changed seldom, so kept out of the way). Highlighted, with the
 *  number of active toggles, while any filter is on. */
function TagFilterMenu({ filter, onChange, hidden }: { filter: TagFilter; onChange: (f: TagFilter) => void; hidden: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = Object.keys(filter).length;
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="filter-menu" ref={ref}>
      <button className={active ? "filter-button active" : "filter-button"} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
        Filters{active ? ` (${active})` : ""}
      </button>
      {open && (
        <div className="filter-pop" role="group" aria-label="Tag filters">
          <p className="muted">Tap a tag: ✓ green = show only garments with it, ✕ red = hide them. Worn items always stay listed.</p>
          <div className="tag-toggles">
            {TAG_IDS.map((t) => {
              const state = filter[t];
              return (
                <button key={t} className={`tag-toggle ${state ?? ""}`} onClick={() => onChange({ ...filter, [t]: nextTagState(state) })}>
                  <span aria-hidden="true">{state === "include" ? "✓ " : state === "exclude" ? "✕ " : ""}</span>
                  {TAGS[t].label}
                  <span className="sr-only">{state === "include" ? " (only)" : state === "exclude" ? " (hidden)" : ""}</span>
                </button>
              );
            })}
          </div>
          <div className="filter-pop-foot">
            <span className="muted">{hidden ? `${hidden} garments hidden` : "Nothing hidden"}</span>
            {active > 0 && <button onClick={() => onChange({})}>Clear</button>}
            <button className="primary" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
