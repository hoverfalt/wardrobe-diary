import { describe, expect, it } from "vitest";
import { nextSort, sortRows } from "./sorting";

describe("sorting", () => {
  const rows = [{ n: 2 }, { n: null }, { n: 10 }, { n: 1 }];
  it("sorts numbers both ways, empty values last", () => {
    expect(sortRows(rows, (r) => r.n, "desc").map((r) => r.n)).toEqual([10, 2, 1, null]);
    expect(sortRows(rows, (r) => r.n, "asc").map((r) => r.n)).toEqual([1, 2, 10, null]);
  });

  it("sorts text alphabetically (Finnish collation)", () => {
    expect(sortRows([{ s: "Ö" }, { s: "a" }, { s: "Z" }], (r) => r.s, "asc").map((r) => r.s)).toEqual(["a", "Z", "Ö"]);
  });

  it("starts numbers largest first and toggles on repeated clicks", () => {
    const s1 = nextSort({ key: "default", dir: "desc" }, "price", "number");
    expect(s1).toEqual({ key: "price", dir: "desc" });
    expect(nextSort(s1, "price", "number")).toEqual({ key: "price", dir: "asc" });
    expect(nextSort(s1, "name", "text")).toEqual({ key: "name", dir: "asc" });
  });
});
