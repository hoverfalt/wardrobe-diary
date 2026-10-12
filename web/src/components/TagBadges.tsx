// Small badges for garment tags (e.g. "SH" = second hand), next to names and in legends.
import { CHART_TAGS, TAGS, tagsOf, type Tag } from "../lib/tags";
import type { Garment } from "../types";

export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <abbr className="tag-badge" title={TAGS[tag].label}>
      {TAGS[tag].badge}
    </abbr>
  );
}

/** Chart legend entries for the chart tags (CHART_TAGS) present among `garments`. */
export function TagLegendItems({ garments }: { garments: Pick<Garment, "tags">[] }) {
  const present = CHART_TAGS.filter((t) => garments.some((g) => g.tags?.includes(t)));
  return <>{present.map((t) => <li key={t}><TagBadge tag={t} /> {TAGS[t].label}</li>)}</>;
}

export function TagBadges({ garment }: { garment: Pick<Garment, "tags"> }) {
  const tags = tagsOf(garment);
  return tags.length ? <>{tags.map((t) => <TagBadge key={t} tag={t} />)}</> : null;
}
