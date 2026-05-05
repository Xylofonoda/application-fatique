import { describe, it, expect } from "vitest";
import { FillPlanSchema } from "@/lib/apply/fillPlan";

describe("FillPlanSchema — Zod validation", () => {
  const validPlan = {
    fills: [
      { idx: 0, value: "Jane Doe" },
      { idx: 1, value: "jane@example.com" },
    ],
    submitIdx: 5,
  };

  it("accepts a valid plan with no optional fields", () => {
    expect(() => FillPlanSchema.parse(validPlan)).not.toThrow();
  });

  it("accepts a plan with optional fileUploadIdx", () => {
    const plan = { ...validPlan, fileUploadIdx: 3 };
    expect(() => FillPlanSchema.parse(plan)).not.toThrow();
  });

  it("rejects when fills is missing", () => {
    expect(() => FillPlanSchema.parse({ submitIdx: 0 })).toThrow();
  });

  it("rejects when submitIdx is missing", () => {
    expect(() => FillPlanSchema.parse({ fills: [] })).toThrow();
  });

  it("rejects a fill entry with a non-integer idx", () => {
    const plan = { fills: [{ idx: 1.5, value: "x" }], submitIdx: 0 };
    expect(() => FillPlanSchema.parse(plan)).toThrow();
  });

  it("rejects a fill entry with a missing value", () => {
    const plan = { fills: [{ idx: 0 }], submitIdx: 0 };
    expect(() => FillPlanSchema.parse(plan)).toThrow();
  });

  it("rejects a non-integer submitIdx", () => {
    const plan = { fills: [], submitIdx: "5" };
    expect(() => FillPlanSchema.parse(plan)).toThrow();
  });

  it("rejects a non-integer fileUploadIdx", () => {
    const plan = { ...validPlan, fileUploadIdx: "3" };
    expect(() => FillPlanSchema.parse(plan)).toThrow();
  });

  it("accepts empty fills array (no text fields, only submit)", () => {
    const plan = { fills: [], submitIdx: 2 };
    expect(() => FillPlanSchema.parse(plan)).not.toThrow();
  });

  it("parsed plan has correct shape", () => {
    const parsed = FillPlanSchema.parse(validPlan);
    expect(parsed.fills).toHaveLength(2);
    expect(parsed.fills[0]).toMatchObject({ idx: 0, value: "Jane Doe" });
    expect(parsed.submitIdx).toBe(5);
    expect(parsed.fileUploadIdx).toBeUndefined();
  });
});
