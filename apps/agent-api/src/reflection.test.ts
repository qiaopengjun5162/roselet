import { describe, expect, it } from "vitest";
import {
  generateReflection,
  generateReflectionFromCleanedInput,
  InvalidReflectionInput,
  validateReflectionInput,
} from "./reflection.js";

describe("generateReflection", () => {
  it("uses the Rust recommendation engine and returns cleaned input", () => {
    const result = generateReflection({
      color: "white",
      gratitude: "  谢谢今天帮助我的朋友  ",
      anxiety: "",
    });

    expect(result.input).toEqual({
      color: "white",
      gratitude: "谢谢今天帮助我的朋友",
    });
    expect(result.recommendation.flower_language.title).toBeTruthy();
    expect(result.recommendation.theme.title).toBeTruthy();
    expect(result.recommendation.color_suggestion.color).toMatch(/^(red|white|yellow)$/);
  });

  it("surfaces Rust validation errors", () => {
    expect(() => generateReflection({ color: "blue", gratitude: "hello" })).toThrow(InvalidReflectionInput);
    expect(() => generateReflection({ color: "red" })).toThrow("empty_content");
  });

  it("can validate before payment and recommend after payment", () => {
    const input = validateReflectionInput({ color: "red", anxiety: "  worried  " });

    expect(input).toEqual({ color: "red", anxiety: "worried" });
    expect(generateReflectionFromCleanedInput(input).input).toBe(input);
  });
});
