import { describe, expect, it } from "vitest";

import {
  convertPhysicalArea,
  convertPhysicalLength,
  formatArchitecturalArea,
  formatArchitecturalLength,
  formatDisplayValue,
  normalizeDisplayValue
} from "./physical-measurement.js";

describe("physical measurement conversion", () => {
  it.each([
    [400, "cm", "m", 4],
    [386.56, "cm", "m", 3.8656],
    [0.5, "cm", "m", 0.005],
    [0, "cm", "m", 0],
    [-125, "cm", "m", -1.25],
    [4, "m", "cm", 400],
    [4, "m", "m", 4]
  ] as const)("converts %s %s to %s", (value, source, target, expected) => {
    expect(convertPhysicalLength(value, source, target)).toBeCloseTo(expected);
  });

  it("converts squared units with the square of the linear factor", () => {
    expect(convertPhysicalArea(123_456, "cm", "m")).toBeCloseTo(12.3456);
    expect(convertPhysicalArea(12.3456, "m", "cm")).toBeCloseTo(123_456);
  });
});

describe("architectural measurement formatting", () => {
  it.each([
    [400, "4.00 m"],
    [386.56, "3.87 m"],
    [90, "0.90 m"],
    [0.1, "0.00 m"],
    [0, "0.00 m"],
    [-125, "-1.25 m"],
    [120.0000000003, "1.20 m"],
    [386.561, "3.87 m"]
  ])("formats %s canonical centimeters", (value, expected) => {
    expect(formatArchitecturalLength(value, "cm")).toBe(expected);
  });

  it.each([
    [123_456, "12.35 m²"],
    [10_000, "1.00 m²"],
    [0.00000003, "0.00 m²"],
    [0, "0.00 m²"]
  ])("formats %s square centimeters", (value, expected) => {
    expect(formatArchitecturalArea(value, "cm")).toBe(expected);
  });

  it("keeps display normalization separate and suppresses floating-point noise", () => {
    expect(normalizeDisplayValue(1.005, 2)).toBe(1.01);
    expect(normalizeDisplayValue(-0.0000001, 2)).toBe(0);
    expect(formatDisplayValue(4, 2)).toBe("4");
    expect(formatDisplayValue(4, 2, true)).toBe("4.00");
  });
});
