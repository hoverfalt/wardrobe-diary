// Table sorting: numbers largest first on the first click, then smallest first; texts A–Z first.
// Empty values (null) always go last, whichever the direction.

export type SortDir = "desc" | "asc";
export type SortValue = number | string | null | undefined;

export function sortRows<T>(rows: T[], value: (row: T) => SortValue, dir: SortDir): T[] {
  return [...rows].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
    const c = typeof x === "string" && typeof y === "string" ? x.localeCompare(y, "fi") : Number(x) - Number(y);
    return dir === "asc" ? c : -c;
  });
}

/** The direction a column starts with: numbers largest first, texts A–Z. */
export function firstDir(kind: "number" | "text"): SortDir {
  return kind === "number" ? "desc" : "asc";
}

/** Next sort state after clicking a column: a new column starts with its first direction; clicking the
 *  sorted column again toggles. */
export function nextSort<K extends string>(current: { key: K; dir: SortDir }, key: K, kind: "number" | "text"): { key: K; dir: SortDir } {
  if (current.key !== key) return { key, dir: firstDir(kind) };
  return { key, dir: current.dir === "desc" ? "asc" : "desc" };
}
