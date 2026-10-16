import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodePublicData } from "../../web/src/lib/publicData";
import { grade, parseNumber } from "./cli";
import { QUESTIONS } from "./questions";

describe("evaluation grading", () => {
  it("reads numbers written in different ways", () => {
    expect(parseNumber("0.85")).toBe(0.85);
    expect(parseNumber("0,85 €")).toBe(0.85);
    expect(parseNumber("15,589.20")).toBe(15589.2);
    expect(parseNumber("about 42.5 %")).toBe(42.5);
    expect(parseNumber("none")).toBeNull();
  });

  it("grades numbers within tolerance, names and lists", () => {
    expect(grade("1.30", { type: "number", value: 1.2958, tolerance: 0.01, unit: "EUR" }).correct).toBe(true);
    expect(grade("1.31", { type: "number", value: 1.2958, tolerance: 0.01, unit: "EUR" }).correct).toBe(false);
    expect(grade("Shirts", { type: "name", oneOf: ["Shirts"] }).correct).toBe(true);
    expect(grade("b; a", { type: "names", value: ["A", "B"] }).correct).toBe(true);
    expect(grade("a", { type: "names", value: ["A", "B"] }).correct).toBe(false);
  });

  const SNAPSHOT = new URL("./data/public-data.json", import.meta.url);
  it.skipIf(!existsSync(SNAPSHOT))("computes a valid expected answer for every question", () => {
    const w = decodePublicData(JSON.parse(readFileSync(SNAPSHOT, "utf8")).data);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      const e = q.expected(w);
      if (e.type === "number") expect(Number.isFinite(e.value), q.id).toBe(true);
      else if (e.type === "name") expect(e.oneOf.length, q.id).toBeGreaterThan(0);
      else expect(e.value.length, q.id).toBeGreaterThan(0);
    }
  });
});
