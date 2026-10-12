import { describe, expect, it } from "vitest";
import type { Garment } from "../types";
import { dayLabel, recentWears, toggleWorn, nextTagState, passesTagFilter } from "./logging";

const g = (id: string) => ({ id }) as Garment;
const garments = [g("a"), g("b"), g("c")];

describe("logging", () => {
  it("toggles a garment on and off, with public data indexes", () => {
    expect(toggleWorn(garments, ["a"], "c", true)).toEqual({ ids: ["a", "c"], indexes: [0, 2] });
    expect(toggleWorn(garments, ["a", "c"], "a", false)).toEqual({ ids: ["c"], indexes: [2] });
    expect(toggleWorn(garments, ["a"], "a", true)).toEqual({ ids: ["a"], indexes: [0] }); // no duplicates
  });

  it("counts recent wears before the date", () => {
    const days = [
      { date: "2026-08-01", worn: ["a"] }, // older than 60 days
      { date: "2026-10-01", worn: ["a", "b"] },
      { date: "2026-10-08", worn: ["b"] },
      { date: "2026-10-09", worn: ["c"] }, // the day itself is not counted
    ];
    const counts = recentWears(days, "2026-10-09");
    expect(Object.fromEntries(counts)).toEqual({ a: 1, b: 2 });
  });

  it("labels days", () => {
    expect(dayLabel("2026-10-09", "2026-10-09")).toBe("Today, Friday 9.10.2026");
    expect(dayLabel("2026-10-08", "2026-10-09")).toBe("Yesterday, Thursday 8.10.2026");
  });
});

describe("tag toggles", () => {
  const hanko = { tags: ["hanko", "summer"] };
  const winter = { tags: ["winter"] };
  const plain = {};
  it("cycles neutral → include → exclude → neutral", () => {
    expect(nextTagState(undefined)).toBe("include");
    expect(nextTagState("include")).toBe("exclude");
    expect(nextTagState("exclude")).toBeUndefined();
  });
  it("hides red tags and, with green tags, shows only garments having one", () => {
    expect([hanko, winter, plain].map((g) => passesTagFilter(g, {}))).toEqual([true, true, true]);
    expect([hanko, winter, plain].map((g) => passesTagFilter(g, { hanko: "exclude", summer: "exclude" }))).toEqual([false, true, true]);
    expect([hanko, winter, plain].map((g) => passesTagFilter(g, { winter: "include" }))).toEqual([false, true, false]);
    expect([hanko, winter, plain].map((g) => passesTagFilter(g, { winter: "include", hanko: "include" }))).toEqual([true, true, false]);
    // Red wins over green
    expect(passesTagFilter(hanko, { summer: "include", hanko: "exclude" })).toBe(false);
  });
});
