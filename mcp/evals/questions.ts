// AI evaluation questions (ROADMAP R-40 phase 4). Each question's correct answer is computed from the frozen
// snapshot with the app's own metrics (web/src/lib), never typed by hand. Kinds:
//   lookup      a fact stored in the data
//   metric      a figure the semantic model defines, where a plain reading usually works
//   definition  a figure where the precise definition matters (lifetime cost per wear, unworn garments,
//               ownership periods, Sportswear left out…): the questions the semantic layer is meant to get right
import { categoryListing, dailyCost, isActive, itemListing, type DateRange } from "../../web/src/lib/metrics";
import { fibreClass, materialBreakdown, materialsByMonth } from "../../web/src/lib/materials";
import type { Wardrobe } from "../../web/src/lib/publicData";
import { hasTag } from "../../web/src/lib/tags";

export type Expected =
  | { type: "number"; value: number; tolerance: number; unit: string }
  | { type: "name"; oneOf: string[] }
  | { type: "names"; value: string[] };

export interface Question {
  id: string;
  kind: "lookup" | "metric" | "definition";
  question: string;
  /** Metric ids from the semantic model the answer depends on (for the results page). */
  metrics: string[];
  expected: (w: Wardrobe) => Expected;
}

const Y2025: DateRange = { from: "2025-01-01", to: "2025-12-31" };
const Y2024: DateRange = { from: "2024-01-01", to: "2024-12-31" };
const ALL: DateRange = { from: "2018-01-01", to: "2026-09-30" };
const row = (w: Wardrobe, range: DateRange, category: string) => categoryListing(w.garments, w.days, range).find((r) => r.category === category)!;
const garmentNamed = (w: Wardrobe, name: string) => w.garments.find((g) => g.item === name)!;
const eur = (value: number, tolerance = 0.01) => ({ type: "number" as const, value, tolerance, unit: "EUR" });
const pct = (share: number, tolerance = 0.5) => ({ type: "number" as const, value: share * 100, tolerance, unit: "percent" });
const count = (value: number) => ({ type: "number" as const, value, tolerance: 0, unit: "count" });

export const QUESTIONS: Question[] = [
  // --- Lookups
  { id: "price-vest", kind: "lookup", metrics: [], question: "What was the purchase price of the garment named \"North Bend black vest\", in euros?",
    expected: (w) => eur(garmentNamed(w, "North Bend black vest").price!) },
  { id: "purchased-barbour", kind: "lookup", metrics: [], question: "In which year was the \"Barbour Classic Tartan navy\" bought? Answer with the year.",
    expected: (w) => count(Number(garmentNamed(w, "Barbour Classic Tartan navy").purchased!.slice(0, 4))) },
  { id: "worn-2025-06-15", kind: "lookup", metrics: [], question: "Which garments were worn on 15 June 2025? List their names, separated by semicolons.",
    expected: (w) => ({ type: "names", value: (w.days.find((d) => d.date === "2025-06-15")?.worn ?? []).map((id) => w.garments.find((g) => g.id === id)!.item) }) },
  { id: "wears-march-2025", kind: "lookup", metrics: [], question: "How many wears in total were logged in March 2025 (one garment on one day = one wear)?",
    expected: (w) => count(w.days.filter((d) => d.date.startsWith("2025-03")).reduce((s, d) => s + d.worn.length, 0)) },
  { id: "distinct-2025", kind: "lookup", metrics: [], question: "How many different garments were worn at least once in 2025?",
    expected: (w) => count(new Set(w.days.filter((d) => d.date.startsWith("2025")).flatMap((d) => d.worn)).size) },
  { id: "divested-2024", kind: "lookup", metrics: [], question: "How many garments were divested (got a divest date) in 2024?",
    expected: (w) => count(w.garments.filter((g) => g.divested?.startsWith("2024")).length) },

  // --- Metrics
  { id: "active-2026-10-01", kind: "metric", metrics: ["active-items"], question: "How many garments were active (owned) on 1 October 2026?",
    expected: (w) => count(w.garments.filter((g) => isActive(g, "2026-10-01")).length) },
  { id: "value-2025-12-31", kind: "metric", metrics: ["inventory-value"], question: "What was the total inventory value (sum of purchase prices of active garments) on 31 December 2025, in euros?",
    expected: (w) => eur(categoryListing(w.garments, w.days, { from: "2018-01-01", to: "2025-12-31" })[0].inventoryValue, 1) },
  { id: "value-jackets-2020", kind: "metric", metrics: ["inventory-value"], question: "What was the inventory value of the Jackets and hoodies category on 1 January 2020, in euros?",
    expected: (w) => eur(row(w, { from: "2018-01-01", to: "2020-01-01" }, "Jackets and hoodies").inventoryValue, 1) },
  { id: "most-worn-2025", kind: "metric", metrics: ["times-worn"], question: "Which garment was worn the most times in 2025? Give its name.",
    expected: (w) => {
      const rows = itemListing(w.garments, w.days, Y2025);
      const top = Math.max(...rows.map((r) => r.timesWorn));
      return { type: "name", oneOf: rows.filter((r) => r.timesWorn === top).map((r) => r.garment.item) };
    } },
  { id: "times-vest-2023", kind: "metric", metrics: ["times-worn"], question: "How many times was the \"North Bend black vest\" worn in 2023?",
    expected: (w) => count(itemListing([garmentNamed(w, "North Bend black vest")], w.days, { from: "2023-01-01", to: "2023-12-31" })[0].timesWorn) },
  { id: "days-used-shoes-2025", kind: "metric", metrics: ["days-used"], question: "In 2025, on what share of days was at least one pair of shoes (category Shoes) worn? Answer as a percentage.",
    expected: (w) => pct(row(w, Y2025, "Shoes").daysUsed!) },
  { id: "hanko-active", kind: "metric", metrics: ["active-items"], question: "How many garments tagged Hanko were active on 1 October 2026?",
    expected: (w) => count(w.garments.filter((g) => hasTag(g, "hanko") && isActive(g, "2026-10-01")).length) },
  { id: "second-hand-share-2025", kind: "metric", metrics: ["second-hand-share"], question: "What share of the garments active at the end of 2025 were bought second hand? Answer as a percentage.",
    expected: (w) => pct(categoryListing(w.garments, w.days, { from: "2018-01-01", to: "2025-12-31" })[0].secondHandShare!) },
  { id: "outfit-weight-2025", kind: "metric", metrics: ["average-outfit-weight"], question: "What was the average weight of an outfit (garments worn per logged day, those with a known weight) in 2025, in kilograms?",
    expected: (w) => ({ type: "number", value: materialBreakdown(w.garments, w.days, Y2025, "worn").averageOutfitKg!, tolerance: 0.02, unit: "kg" }) },
  { id: "wool-owned", kind: "metric", metrics: ["fibre-mass"], question: "How many kilograms of wool did the wardrobe contain on 30 September 2026 (garments active then, weight × material composition)?",
    expected: (w) => ({ type: "number", value: materialBreakdown(w.garments, w.days, { from: "2018-01-01", to: "2026-09-30" }, "owned").fibres.find((f) => f.fibre === "wool")?.kg ?? 0, tolerance: 0.1, unit: "kg" }) },
  { id: "synthetic-2025", kind: "metric", metrics: ["synthetic-share", "fibre-mass"], question: "What share of the mass of clothes worn in 2025 (each wear counting the garment's weight) was synthetic fibre? Answer as a percentage.",
    expected: (w) => {
      const b = materialBreakdown(w.garments, w.days, Y2025, "worn");
      return pct(b.fibres.filter((f) => fibreClass(f.fibre) === "synthetic").reduce((s, f) => s + f.share, 0), 1);
    } },

  // --- Definition-sensitive
  { id: "cpw-vest-2024", kind: "definition", metrics: ["garment-cost-per-wear"], question: "What was the cost per wear of the \"North Bend black vest\" in 2024, in euros?",
    expected: (w) => eur(itemListing([garmentNamed(w, "North Bend black vest")], w.days, Y2024)[0].costPerWear!, 0.002) },
  { id: "cpw-shirts-2025", kind: "definition", metrics: ["category-cost-per-wear"], question: "What was the cost per wear of the Shirts category in 2025, in euros?",
    expected: (w) => eur(row(w, Y2025, "Shirts").costPerWear!) },
  { id: "cpw-socks-2025", kind: "definition", metrics: ["category-cost-per-wear"], question: "What was the cost per wear of the Socks category in 2025, in euros?",
    expected: (w) => eur(row(w, Y2025, "Socks").costPerWear!) },
  { id: "cpw-belts-2025", kind: "definition", metrics: ["category-cost-per-wear"], question: "What was the cost per wear of the Belts category in 2025, in euros?",
    expected: (w) => eur(row(w, Y2025, "Belts").costPerWear!) },
  { id: "cpw-blazers-2025", kind: "definition", metrics: ["category-cost-per-wear"], question: "What was the cost per wear of the Blazers and vests category in 2025, in euros?",
    expected: (w) => eur(row(w, Y2025, "Blazers and vests").costPerWear!) },
  { id: "yearly-pants-2024", kind: "definition", metrics: ["yearly-cost", "category-cost-per-wear", "days-used"], question: "What was the yearly cost of the Pants category in 2024, in euros?",
    expected: (w) => eur(row(w, Y2024, "Pants").yearlyCost!, 1) },
  { id: "monthly-shoes-2025", kind: "definition", metrics: ["monthly-cost", "yearly-cost"], question: "What was the monthly cost of the Shoes category in 2025, in euros?",
    expected: (w) => eur(row(w, Y2025, "Shoes").yearlyCost! / 12, 0.1) },
  { id: "turnover-boxers", kind: "definition", metrics: ["turnover"], question: "What is the inventory turnover of the Underwear boxers category over the whole period from 1 January 2018 to 30 September 2026? Answer as a percentage.",
    expected: (w) => pct(row(w, ALL, "Underwear boxers").turnover!) },
  { id: "highest-yearly", kind: "definition", metrics: ["yearly-cost"], question: "Which category had the highest yearly cost over the whole period from 1 January 2018 to 30 September 2026? Give the category name.",
    expected: (w) => {
      const rows = categoryListing(w.garments, w.days, ALL).slice(1);
      const top = Math.max(...rows.map((r) => r.yearlyCost ?? 0));
      return { type: "name", oneOf: rows.filter((r) => r.yearlyCost === top).map((r) => r.category) };
    } },
  { id: "days-used-socks-all", kind: "definition", metrics: ["days-used"], question: "Over the whole period from 1 January 2018 to 30 September 2026, on what share of days were socks worn? Answer as a percentage.",
    expected: (w) => pct(row(w, ALL, "Socks").daysUsed!) },
  { id: "daily-cost-sep-2025", kind: "definition", metrics: ["daily-cost"], question: "What was the average daily cost (the cost per wear of everything worn that day, Sportswear excluded) over the days with wears in September 2025, in euros?",
    expected: (w) => {
      const points = dailyCost(w.garments.filter((g) => g.category !== "Sportswear"), w.days, { from: "2025-09-01", to: "2025-09-30" });
      return eur(points.reduce((s, p) => s + p.cost, 0) / points.length, 0.05);
    } },
  { id: "wears-per-month-vest", kind: "definition", metrics: ["wears-per-month"], question: "How many times per month, on average, has the \"North Bend black vest\" been worn over its whole ownership up to 30 September 2026?",
    expected: (w) => ({ type: "number", value: itemListing([garmentNamed(w, "North Bend black vest")], w.days, ALL)[0].wearsPerMonth, tolerance: 0.05, unit: "wears per month" }) },
  { id: "synthetic-share-sep-2025", kind: "definition", metrics: ["synthetic-share"], question: "In September 2025, what share of the worn fibre mass was synthetic? Answer as a percentage.",
    expected: (w) => pct(materialsByMonth(w.garments, w.days, { from: "2025-09-01", to: "2025-09-30" }).find((m) => m.month === "2025-09")!.syntheticShare!, 1) },
];
