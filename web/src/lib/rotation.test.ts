import { describe, expect, it } from "vitest";
import type { Garment } from "../types";
import { wearIndex } from "./metrics";
import { logEntries, rotationOrder, rotationRanks, seriesOf } from "./rotation";

const g = (id: string, item: string, extra: Partial<Garment> = {}): Garment => ({
  id, category: "Socks", item, details: "", photo: "", price: 2.5, purchased: "2022-07-30", divested: null, timesUsedInit: 0, materials: "", weightG: null, ...extra,
});
const socks = ["01", "02", "03", "04"].map((n) => g(`s${n}`, `SOC U 4P Black ${n} (39-42)`));
const other = g("x", "Falke blue");
const KEY = "Socks|SOC U 4P Black (39-42)";
// 01 and 03 worn twice, 02 and 04 once.
const days = [
  { date: "2026-10-01", worn: ["s01"] },
  { date: "2026-10-02", worn: ["s02"] },
  { date: "2026-10-03", worn: ["s03"] },
  { date: "2026-10-04", worn: ["s04"] },
  { date: "2026-10-05", worn: ["s01"] },
  { date: "2026-10-06", worn: ["s03"] },
];
const wears = wearIndex(days);

describe("rotation series", () => {
  it("names a series by the garment name without its number, keeping a size in brackets", () => {
    expect(seriesOf(socks[0])).toEqual({ key: KEY, name: "SOC U 4P Black (39-42)", number: "01" });
    expect(seriesOf(g("j", "Jockey white 04", { category: "Underwear shirts" }))?.key).toBe("Underwear shirts|Jockey white");
    expect(seriesOf(other)).toBeNull();
  });

  it("orders by fewest lifetime wears, then the lowest number", () => {
    expect(rotationOrder(socks, wears).map((s) => s.id)).toEqual(["s02", "s04", "s01", "s03"]);
    // Pre-tracking wears count too (lifetime wears).
    const withInit = socks.map((s) => (s.id === "s02" ? { ...s, timesUsedInit: 5 } : s));
    expect(rotationOrder(withInit, wears)[0].id).toBe("s04");
    // Numbers compare as numbers.
    const many = [g("a", "Sock 10"), g("b", "Sock 9")];
    expect(rotationOrder(many, new Map()).map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("ranks only garments of marked series", () => {
    expect(rotationRanks([...socks, other], new Set([KEY]), wears)).toEqual(new Map([["s02", 0], ["s04", 1], ["s01", 2], ["s03", 3]]));
    expect(rotationRanks([...socks, other], new Set(), wears).size).toBe(0);
  });

  it("shows a marked series as one tile with the next in line", () => {
    const all = () => true;
    const entries = logEntries([...socks, other], all, new Set(), new Set([KEY]), wears);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ kind: "series", name: "SOC U 4P Black (39-42)", worn: null, next: { id: "s02" } });
    expect(entries[0].kind === "series" && entries[0].members).toHaveLength(4);
    expect(entries[1]).toMatchObject({ kind: "garment", garment: { id: "x" } });
    // Unmarked: every garment on its own.
    expect(logEntries([...socks, other], all, new Set(), new Set(), wears)).toHaveLength(5);
  });

  it("shows the worn member, and the next among the others", () => {
    const [entry] = logEntries(socks, () => true, new Set(["s02"]), new Set([KEY]), wears);
    expect(entry).toMatchObject({ kind: "series", worn: { id: "s02" }, next: { id: "s04" } });
  });

  it("lists the members one by one when the search matches only some of them", () => {
    const matches = (q: string) => (x: Garment) => x.item.toLowerCase().includes(q);
    expect(logEntries(socks, matches("soc u"), new Set(), new Set([KEY]), wears)).toMatchObject([{ kind: "series" }]);
    expect(logEntries(socks, matches("black 03"), new Set(), new Set([KEY]), wears)).toEqual([{ kind: "garment", garment: socks[2] }]);
  });

  it("shows a single remaining member as a plain garment", () => {
    expect(logEntries([socks[0], other], () => true, new Set(), new Set([KEY]), wears).map((e) => e.kind)).toEqual(["garment", "garment"]);
  });
});
