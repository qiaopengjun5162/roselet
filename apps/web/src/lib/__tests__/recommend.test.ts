import { getRecommendation } from "../recommend";

describe("getRecommendation", () => {
  it("should return null when WASM module not available", async () => {
    // WASM module won't load in test environment
    const result = await getRecommendation([]);
    expect(result).toBeNull();
  });

  it("should return null for empty input", async () => {
    const result = await getRecommendation([]);
    expect(result).toBeNull();
  });
});
