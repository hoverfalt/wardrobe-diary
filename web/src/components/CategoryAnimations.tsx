// Animated category charts (the live site's GIFs, made interactive): the same charts as known on an
// "as of" date, counting only the wears logged by then.
import { useMemo } from "react";
import { itemListing, type DateRange } from "../lib/metrics";
import type { Day, Garment } from "../types";
import { useAsOf } from "./AsOfControl";
import { animationDomains, CostVsFrequencyChart } from "./ItemCharts";
import { TimesWornChart } from "./TimesWornChart";

interface Props {
  garments: Garment[];
  days: Day[];
  range: DateRange;
}

export function TimesWornAnimation({ garments, days, range }: Props) {
  const { asOf, control } = useAsOf(range);
  const final = useMemo(() => itemListing(garments, days, range), [garments, days, range]);
  const rows = useMemo(() => itemListing(garments, days, range, asOf), [garments, days, range, asOf]);
  const xMax = Math.max(1, ...final.map((r) => r.timesWorn));
  return (
    <>
      {control}
      <TimesWornChart rows={rows} minRows={final.length} xMax={xMax} />
    </>
  );
}

export function CostVsFrequencyAnimation({ garments, days, range }: Props) {
  const { asOf, control } = useAsOf(range);
  const final = useMemo(() => itemListing(garments, days, range), [garments, days, range]);
  const domains = useMemo(() => animationDomains(final), [final]);
  const rows = useMemo(() => itemListing(garments, days, range, asOf), [garments, days, range, asOf]);
  return (
    <>
      {control}
      <CostVsFrequencyChart rows={rows} xDomain={domains.x} yDomain={domains.y} />
    </>
  );
}
