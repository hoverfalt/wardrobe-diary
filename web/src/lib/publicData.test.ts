import { describe, expect, it } from "vitest";
import type { Garment } from "../types";
import { decodePublicData } from "./publicData";

const g = (id: string) => ({ id }) as Garment;

describe("decodePublicData", () => {
  it("turns garment indexes back into ids and sorts days", () => {
    const w = decodePublicData({
      version: 1,
      garments: [g("a"), g("b")],
      days: { "2018-01-02": [1], "2018-01-01": [0, 1] },
    });
    expect(w.days).toEqual([
      { date: "2018-01-01", worn: ["a", "b"] },
      { date: "2018-01-02", worn: ["b"] },
    ]);
  });
});
