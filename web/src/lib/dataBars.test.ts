import { describe, expect, it } from "vitest";
import { barFraction, barMax, barStyle } from "./dataBars";

describe("data bars", () => {
  it("takes the max over positive values, ignoring nulls", () => {
    expect(barMax([3, null, 10.5, -2])).toBe(10.5);
    expect(barMax([null])).toBe(0);
  });

  it("scales to the max and clips above it, like the live site's Total row", () => {
    expect(barFraction(31, 62)).toBe(0.5);
    expect(barFraction(311, 62)).toBe(1);
    expect(barFraction(0, 62)).toBe(0);
    expect(barFraction(null, 62)).toBe(0);
  });

  it("draws the bar from the right", () => {
    expect(barStyle(31, 62, "red")?.background).toBe("linear-gradient(90deg, transparent 50.00%, red 50.00%)");
    expect(barStyle(0, 62, "red")).toBeUndefined();
  });
});
