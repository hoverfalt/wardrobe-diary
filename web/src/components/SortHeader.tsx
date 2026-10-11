// A clickable, accessible table header for sortable columns.
import type { SortDir } from "../lib/sorting";

export function SortHeader({
  title,
  active,
  dir,
  onClick,
  className,
  hint,
  showArrow = true,
}: {
  title: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
  /** Tooltip, e.g. "Back to the standard order". */
  hint?: string;
  /** False for "back to the default order" headers, whose order isn't a direction. */
  showArrow?: boolean;
}) {
  return (
    <th className={className} aria-sort={active && showArrow ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="sort-header" onClick={onClick} title={hint ?? `Sort by ${title.toLowerCase()}`}>
        {title}
        <span className="sort-arrow" aria-hidden="true">{active && showArrow ? (dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}
