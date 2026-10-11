// Small badges for garment tags (e.g. "SH" = second hand), next to names and in legends.
import { TAGS, tagsOf, type Tag } from "../lib/tags";
import type { Garment } from "../types";

export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <abbr className="tag-badge" title={TAGS[tag].label}>
      {TAGS[tag].badge}
    </abbr>
  );
}

export function TagBadges({ garment }: { garment: Pick<Garment, "tags"> }) {
  const tags = tagsOf(garment);
  return tags.length ? <>{tags.map((t) => <TagBadge key={t} tag={t} />)}</> : null;
}
