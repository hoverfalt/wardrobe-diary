// Links from figures to their definitions in the semantic layer (R-40, R-43): "How it's calculated" under charts and
// "Definitions" under tables. Each link shows the definition in a small popup where the reader is (hover or keyboard
// focus on a computer, a first tap on a phone) and opens the full entry on /glossary or /model (a click, or "More"
// in the popup). Ids are the semantic layer's ("metric:daily-cost", "term:cost-per-wear"); semantics.test.ts checks
// that every id used in the app exists. Texts come from the generated labels.json.
import { useEffect, useId, useRef, useState } from "react";
import labels from "../generated/labels.json";

type Ref = `metric:${string}` | `term:${string}`;
type Entry = { label: string; definition: string; formula?: string };

const href = (ref: Ref) => {
  const [kind, id] = ref.split(":");
  return kind === "metric" ? `/model#metric-${id}` : `/glossary#${id}`;
};
const entry = (ref: Ref): Entry | undefined => {
  const [kind, id] = ref.split(":") as ["metric" | "term", string];
  return (labels[kind] as Record<string, Entry>)[id];
};

/** Only one popup open at a time: opening one closes the others. */
const closers = new Set<() => void>();

function DefinitionLink({ refId, children }: { refId: Ref; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const hoverTimer = useRef<number | undefined>(undefined);
  const id = useId();
  const e = entry(refId);

  const close = () => setPos(null);
  const open = () => {
    const r = link.current?.getBoundingClientRect();
    if (!r) return;
    closers.forEach((c) => c !== close && c());
    const width = Math.min(320, window.innerWidth - 16);
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: r.bottom + 6, width });
  };

  useEffect(() => {
    closers.add(close);
    return () => void closers.delete(close);
  }, []);
  useEffect(() => {
    if (!pos) return;
    const onDown = (ev: PointerEvent) => {
      if (!link.current?.contains(ev.target as Node) && !pop.current?.contains(ev.target as Node)) close();
    };
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { passive: true, once: true });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close);
    };
  }, [pos]);

  if (!e) return <a href={href(refId)}>{children}</a>;
  return (
    <>
      <a
        ref={link}
        href={href(refId)}
        className="definition-link"
        aria-describedby={pos ? id : undefined}
        onPointerDown={(ev) => (touched.current = ev.pointerType !== "mouse")}
        onClick={(ev) => {
          // A first tap on a touch screen shows the definition; the popup's "More" link opens the full entry.
          if (touched.current && !pos) {
            ev.preventDefault();
            open();
          }
        }}
        onMouseEnter={() => (hoverTimer.current = window.setTimeout(open, 250))}
        onMouseLeave={() => {
          window.clearTimeout(hoverTimer.current);
          hoverTimer.current = window.setTimeout(() => {
            if (!pop.current?.matches(":hover")) close();
          }, 200);
        }}
        onFocus={() => !touched.current && open()}
        onBlur={(ev) => !pop.current?.contains(ev.relatedTarget as Node) && close()}
      >
        {children}
      </a>
      {pos && (
        <div
          ref={pop}
          id={id}
          role="tooltip"
          className="definition-pop"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
          onMouseLeave={close}
        >
          <strong>{e.label}</strong>
          <span>{e.definition}</span>
          {e.formula && <code>{e.formula}</code>}
          <a href={href(refId)}>More: {refId.startsWith("metric:") ? "the full definition on Model" : "the Glossary"} →</a>
        </div>
      )}
    </>
  );
}

/** "How it's calculated: Daily cost" under a chart, linking to the metric's definition on /model. */
export function HowCalculated({ refs }: { refs: Ref[] }) {
  return (
    <p className="how-calculated">
      How it's calculated:{" "}
      {refs.map((r, i) => (
        <span key={r}>
          {i > 0 && ", "}
          <DefinitionLink refId={r}>{entry(r)?.label ?? r}</DefinitionLink>
        </span>
      ))}
    </p>
  );
}

/** "Definitions: Items · Value · …" under a table, with the column titles linking to the glossary. */
export function DefinitionLinks({ items }: { items: [title: string, ref: Ref][] }) {
  return (
    <p className="how-calculated">
      Definitions:{" "}
      {items.map(([title, r], i) => (
        <span key={r}>
          {i > 0 && " · "}
          <DefinitionLink refId={r}>{title}</DefinitionLink>
        </span>
      ))}
    </p>
  );
}
