import { describe, expect, it } from "vitest";
import { slotsForSolver, verifyTemplateInvariants } from "../../../cross/server/src/templateGenerator/generator";
import {
  calculateLengthWeights,
  countDictionaryByLength,
  DEFAULT_DICTIONARY_COUNTS,
  templateSupplyDeficit,
} from "../../../cross/server/src/templateGenerator/weights";

describe("dictionary-aware template lengths", () => {
  it("prioritizes plentiful lengths while keeping two-letter answers exceptional", () => {
    const weights = calculateLengthWeights(DEFAULT_DICTIONARY_COUNTS);
    expect(weights[2]).toBeLessThan(0.001);
    expect(weights[3]).toBeLessThan(0.03);
    expect(weights[5] + weights[6] + weights[7] + weights[8]).toBeGreaterThan(0.75);
    expect(weights[10]).toBe(0);
    expect(Object.values(weights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
  });
  it("loads two-letter supply and passes two-letter slots to the solver", () => {
    expect(countDictionaryByLength(new Map([[2, ["АД", "УМ"]]]))[2]).toBe(2);
    const grid = { rows: 1, cols: 3, data: ["#→*"], codes: [[2, 0x18, 1]] };
    expect(slotsForSolver(grid).map((slot) => slot.len)).toEqual([2]);
  });
  it("rejects multiple two-letter answers in a template", () => {
    const grid = { rows: 1, cols: 6, data: ["#→*#→*"], codes: [[2, 0x18, 1, 2, 0x18, 1]] };
    expect(verifyTemplateInvariants(grid).errors).toContain("at most one two-letter word is allowed");
  });
  it("guides geometry repair with the same unavailable-length and short-word limits as acceptance", () => {
    const weights = calculateLengthWeights(DEFAULT_DICTIONARY_COUNTS);
    expect(templateSupplyDeficit({ 5: 90, 10: 1 }, 91, DEFAULT_DICTIONARY_COUNTS, weights)).toBe(1);
    expect(templateSupplyDeficit({ 3: 20, 5: 80 }, 100, DEFAULT_DICTIONARY_COUNTS, weights)).toBeGreaterThan(0);
    expect(templateSupplyDeficit({ 3: 5, 5: 95 }, 100, DEFAULT_DICTIONARY_COUNTS, weights)).toBe(0);
    expect(templateSupplyDeficit({ 5: 4 }, 4, { 5: 3 })).toBe(1);
    expect(templateSupplyDeficit({ 10: 20 }, 20)).toBe(0);
  });
});
