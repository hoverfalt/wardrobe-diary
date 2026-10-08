// Data bars as on the live site (R DT::styleColorBar): a right-aligned bar whose full width is the
// column's maximum; values above the maximum fill the cell, values ≤ 0 get no bar.
import type { CSSProperties } from "react";

/** Largest positive value, ignoring nulls. The live site takes it over the category rows, not the Total row. */
export function barMax(values: (number | null)[]): number {
  return values.reduce<number>((m, v) => (v != null && Number.isFinite(v) && v > m ? v : m), 0);
}

/** Share of the cell the bar fills, 0…1. */
export function barFraction(value: number | null, max: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0 || max <= 0) return 0;
  return Math.min(value / max, 1);
}

export function barStyle(value: number | null, max: number, color: string): CSSProperties | undefined {
  const f = barFraction(value, max);
  if (f === 0) return undefined;
  const start = `${((1 - f) * 100).toFixed(2)}%`;
  return {
    background: `linear-gradient(90deg, transparent ${start}, ${color} ${start})`,
    backgroundSize: "100% 90%",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  };
}
