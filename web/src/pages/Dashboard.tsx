import { useMemo } from "react";
import { useDays, useGarments } from "../data/repo";
import { todayIso } from "../lib/dates";
import { categorySummary } from "../lib/metrics";

const eur = (v: number | null) => (v == null ? "–" : v.toLocaleString("fi-FI", { style: "currency", currency: "EUR" }));

export function Dashboard({ uid }: { uid: string }) {
  const garments = useGarments(uid);
  const days = useDays(uid);
  const rows = useMemo(
    () => (garments && days ? categorySummary(garments, days, todayIso()) : []),
    [garments, days],
  );

  if (!garments || !days) return <p>Loading…</p>;

  return (
    <section>
      <h2>By category</h2>
      <p className="muted">
        {garments.length} garments · {days.length} logged days
      </p>
      {/* TODO: rebuild the portfolio charts here (active items, inventory value over time,
          cost per wear vs frequency, daily and monthly cost). */}
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Active items</th>
            <th>Inventory value</th>
            <th>Avg cost per wear</th>
            <th>Frequency</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category}>
              <td>{r.category}</td>
              <td className="num">{r.activeItems}</td>
              <td className="num">{eur(r.inventoryValue)}</td>
              <td className="num">{eur(r.avgCostPerWear)}</td>
              <td className="num">{(r.frequency * 100).toFixed(0)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
