// Links from figures to their definitions in the semantic layer (R-40): "How it's calculated" under charts and
// "Definitions" under tables. Ids are the semantic layer's ("metric:daily-cost", "term:cost-per-wear");
// semantics.test.ts checks that every id used in the app exists. Labels come from the generated labels.json.
import labels from "../generated/labels.json";

type Ref = `metric:${string}` | `term:${string}`;

const href = (ref: Ref) => {
  const [kind, id] = ref.split(":");
  return kind === "metric" ? `/model#metric-${id}` : `/glossary#${id}`;
};
const label = (ref: Ref) => {
  const [kind, id] = ref.split(":") as ["metric" | "term", string];
  return (labels[kind] as Record<string, string>)[id] ?? id;
};

/** "How it's calculated: Daily cost" under a chart, linking to the metric's definition on /model. */
export function HowCalculated({ refs }: { refs: Ref[] }) {
  return (
    <p className="how-calculated">
      How it's calculated:{" "}
      {refs.map((r, i) => (
        <span key={r}>
          {i > 0 && ", "}
          <a href={href(r)}>{label(r)}</a>
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
          <a href={href(r)}>{title}</a>
        </span>
      ))}
    </p>
  );
}
