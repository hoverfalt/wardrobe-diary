import { describe, expect, it } from "vitest";
import { isValidRange } from "./dates";

describe("isValidRange", () => {
  const ok = (from: string, to: string) => isValidRange({ from, to }, "2018-01-01", "2026-10-09");

  it("accepts ranges inside the bounds", () => {
    expect(ok("2018-01-01", "2026-10-09")).toBe(true);
    expect(ok("2020-05-05", "2020-05-05")).toBe(true);
  });

  it("rejects half-typed years, out-of-bounds and reversed ranges", () => {
    expect(ok("0202-01-01", "2026-10-09")).toBe(false);
    expect(ok("2018-01-01", "0002-01-01")).toBe(false);
    expect(ok("2017-12-31", "2020-01-01")).toBe(false);
    expect(ok("2018-01-01", "2026-10-10")).toBe(false);
    expect(ok("2021-01-01", "2020-01-01")).toBe(false);
    expect(ok("", "2020-01-01")).toBe(false);
  });
});
