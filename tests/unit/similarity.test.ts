import { describe, it, expect } from "vitest";
import { cosineSimilarity } from "@/lib/similarity";

describe("cosineSimilarity", () => {
  it("returns 1 for identical non-zero vectors", () => {
    const v = [1, 2, 3, 4];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it("returns -1 for opposite vectors", () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it("returns 0 when one vector is all zeros", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
  });

  it("returns 0 for two zero vectors", () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it("handles float vectors correctly", () => {
    const a = [0.5, 0.5];
    const b = [0.5, 0.5];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });

  it("computes correctly for a known example", () => {
    // [1,0] vs [1/√2, 1/√2] should be cos(45°) = √2/2 ≈ 0.707
    const a = [1, 0];
    const b = [Math.SQRT1_2, Math.SQRT1_2];
    expect(cosineSimilarity(a, b)).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it("is symmetric: similarity(a, b) === similarity(b, a)", () => {
    const a = [3, 1, 4, 1, 5];
    const b = [9, 2, 6, 5, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it("scores React vs React embedding higher than React vs Backend", () => {
    // Simulate a domain scoring scenario with toy vectors
    const reactQuery = [1, 0, 0, 0]; // pure React dimension
    const reactJob = [0.9, 0.1, 0, 0]; // mostly React
    const backendJob = [0.1, 0, 0.9, 0]; // mostly Backend
    expect(cosineSimilarity(reactQuery, reactJob))
      .toBeGreaterThan(cosineSimilarity(reactQuery, backendJob));
  });
});
