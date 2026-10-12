// Small badges for garment tags (e.g. "SH" = second hand), next to names and in legends.
import { TAG_IDS, TAGS, tagsOf, type Tag } from "../lib/tags";
import type { Garment } from "../types";

export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <abbr className="tag-badge" title={TAGS[tag].label}>
      {TAGS[tag].badge}
    </abbr>
  );
}

/** Legend entries for the tags present among `garments` (charts show the first tag's badge on each photo). */
export function TagLegendItems({ garments }: { garments: Pick<Garment, "tags">[] }) {
  const present = TAG_IDS.filter((t) => garments.some((g) => g.tags?.includes(t)));
  return <>{present.map((t) => <li key={t}><TagBadge tag={t} /> {TAGS[t].label}</li>)}</>;
}

export function TagBadges({ garment }: { garment: Pick<Garment, "tags"> }) {
  const tags = tagsOf(garment);
  return tags.length ? <>{tags.map((t) => <TagBadge key={t} tag={t} />)}</> : null;
}
