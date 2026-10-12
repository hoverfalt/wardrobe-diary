import { describe, expect, it } from "vitest";
import { comparisonId, comparisonPhotoName, costPerUse, formatFrequency, parseFrequency, parseNumber, yearlyCost } from "./comparison";

describe("comparison", () => {
  it("derives yearly cost and cost per use as the Sheet did", () => {
    // HSL row: 59,7 €/month, 6/7 of days → 716,40 €/year, 2,2836 €/use
    expect(yearlyCost({ monthlyCost: 59.7 })).toBeCloseTo(716.4);
    expect(costPerUse({ monthlyCost: 59.7, useFrequency: 6 / 7 })).toBeCloseTo(2.283606557);
    // Charities: once a month → the whole monthly cost per use
    expect(costPerUse({ monthlyCost: 77, useFrequency: 1 / 30.5 })).toBeCloseTo(77);
    expect(costPerUse({ monthlyCost: 10, useFrequency: 0 })).toBeNull();
  });

  it("reads numbers and frequencies", () => {
    expect(parseNumber("59,70")).toBe(59.7);
    expect(parseNumber("1 047,5 €")).toBe(1047.5);
    expect(parseNumber("abc")).toBeNull();
    expect(parseFrequency("6/7")).toBeCloseTo(6 / 7);
    expect(parseFrequency("85,7 %")).toBeCloseTo(0.857);
    expect(parseFrequency("100")).toBe(1);
    expect(parseFrequency("120")).toBeNull();
    expect(parseFrequency("1/0")).toBeNull();
    expect(formatFrequency(6 / 7)).toBe("85,7");
  });

  it("makes ids and photo names", () => {
    expect(comparisonId("The Economist", [])).toBe("the-economist");
    expect(comparisonId("HSL", ["hsl"])).toBe("hsl-2");
    expect(comparisonPhotoName("City bikes")).toBe("Comparison-City_bikes");
  });
});
