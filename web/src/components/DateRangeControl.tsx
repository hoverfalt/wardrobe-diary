// Date range control: a two-handle slider across the content width plus exact date boxes. The Dashboard
// renders several copies bound to the same state, so they always stay in sync.
import { addDays, dayIndex, formatFi } from "../lib/dates";
import type { DateRange } from "../lib/metrics";

export function DateRangeControl({
  value,
  onChange,
  min,
  max,
  valid,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  min: string;
  max: string;
  valid: boolean;
}) {
  const span = dayIndex(min, max);
  // Half-typed dates can't be placed on the slider; keep the handles in bounds meanwhile.
  const pos = (iso: string) => {
    const i = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? dayIndex(min, iso) : NaN;
    return Number.isFinite(i) ? Math.min(span, Math.max(0, i)) : 0;
  };
  const from = pos(value.from);
  const to = valid ? pos(value.to) : Math.max(from, pos(value.to));
  const pct = (i: number) => `${(i / span) * 100}%`;
  const years: { label: string; at: number }[] = [];
  for (let y = Number(min.slice(0, 4)); y <= Number(max.slice(0, 4)); y++) {
    const at = dayIndex(min, `${y}-01-01`);
    if (at >= 0 && at <= span) years.push({ label: String(y), at });
  }

  return (
    <div className="date-range" role="group" aria-label="Time span">
      <div className="date-range-boxes">
        <label>
          From <input type="date" value={value.from} min={min} max={max}
            onChange={(e) => onChange({ ...value, from: e.target.value })} />
        </label>
        <label>
          To <input type="date" value={value.to} min={min} max={max}
            onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </label>
      </div>
      <div className="date-range-slider">
        <div className="track" />
        <div className="selection" style={{ left: pct(from), width: pct(to - from) }} />
        {/* When the handles meet, the one that can still move must be on top: From in the right half. */}
        <input type="range" min={0} max={span} step={1} value={from} aria-label="From"
          style={{ zIndex: from > span / 2 ? 2 : 1 }}
          aria-valuetext={formatFi(addDays(min, from))}
          onChange={(e) => onChange({ ...value, from: addDays(min, Math.min(Number(e.target.value), to)) })} />
        <input type="range" min={0} max={span} step={1} value={to} aria-label="To"
          style={{ zIndex: from > span / 2 ? 1 : 2 }}
          aria-valuetext={formatFi(addDays(min, to))}
          onChange={(e) => onChange({ ...value, to: addDays(min, Math.max(Number(e.target.value), from)) })} />
      </div>
      <div className="date-range-years" aria-hidden="true">
        {years.map((y) => (
          <span key={y.label} style={{ left: pct(y.at) }}>{y.label}</span>
        ))}
      </div>
      {!valid && (
        <p className="muted">
          Choose dates between {formatFi(min)} and {formatFi(max)}, with From before To.
        </p>
      )}
    </div>
  );
}
