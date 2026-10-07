import { useMemo, useState } from "react";
import { useDays, useGarments } from "../data/repo";
import { todayIso } from "../lib/dates";
import { categoryListing, TRACKING_START, type DateRange } from "../lib/metrics";

const eur0 = (v: number | null) =>
  v == null ? "–" : v.toLocaleString("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = (v: number | null) =>
  v == null ? "–" : v.toLocaleString("fi-FI", { style: "currency", currency: "EUR" });
const pct = (v: number | null) => (v == null ? "–" : `${(v * 100).toFixed(0)} %`);

export function Dashboard({ uid }: { uid: string }) {
  const garments = useGarments(uid);
  const days = useDays(uid);
  const [range, setRange] = useState<DateRange>({ from: TRACKING_START, to: todayIso() });
  const rows = useMemo(
    () => (garments && days && range.from <= range.to ? categoryListing(garments, days, range) : []),
    [garments, days, range],
  );

  if (!garments || !days) return <p>Loading…</p>;

  return (
    <section>
      <h2>Category listing</h2>
      <p className="range">
        <label>
          From <input type="date" value={range.from} min={TRACKING_START} max={range.to}
            onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} />
        </label>
        <label>
          To <input type="date" value={range.to} min={range.from}
            onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} />
        </label>
      </p>
      {range.from > TRACKING_START && (
        <p className="muted">
          Ranges starting after {TRACKING_START} are provisional: only wears inside the range count.
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Active items</th>
            <th>Inventory value</th>
            <th>Cost per wear</th>
            <th>Days used</th>
            <th>Yearly cost</th>
            <th>Inventory turnover</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category} className={r.category === "Total" ? "total" : undefined}>
              <td>{r.category}</td>
              <td className="num">{r.activeItems}</td>
              <td className="num">{eur0(r.inventoryValue)}</td>
              <td className="num">{eur2(r.costPerWear)}</td>
              <td className="num">{pct(r.daysUsed)}</td>
              <td className="num">{eur0(r.yearlyCost)}</td>
              <td className="num">{pct(r.turnover)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
