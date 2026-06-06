const wasmPath = "../../../public/pkg/roselet_recommend.js";

function mockWasm(overrides: Record<string, unknown> = {}) {
  jest.resetModules();
  const wasm = {
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
    recommend: jest.fn().mockReturnValue({ color_suggestion: { color: "yellow" } }),
    analyze_text: jest.fn().mockReturnValue({ emotion_label: "hope" }),
    compute_layout: jest.fn().mockReturnValue({ columns: 2 }),
    filter_roses: jest.fn().mockReturnValue([{ color: "red" }]),
    validate_plant_input: jest.fn().mockReturnValue({ valid: true }),
    parse_garden_response_wasm: jest.fn().mockReturnValue({ items: [], total: 0 }),
    parse_rose_response_wasm: jest.fn().mockReturnValue({ id: "r1" }),
    validate_feedback_input: jest.fn().mockReturnValue({ valid: true }),
    format_date_wasm: jest.fn().mockReturnValue({ relative: "刚刚" }),
    generate_petals_wasm: jest.fn().mockReturnValue([{ left: 10 }]),
    rose_to_sound_params_wasm: jest.fn().mockReturnValue({ base_freq: 220 }),
    compute_sky_params_wasm: jest.fn().mockReturnValue({ label: "夜晚" }),
    generate_star_particles_wasm: jest.fn().mockReturnValue([{ left: 20 }]),
    build_garden_url: jest.fn().mockReturnValue("/garden-from-wasm"),
    build_plant_body: jest.fn().mockReturnValue('{"from":"wasm"}'),
    color_emoji: jest.fn().mockReturnValue("R"),
    color_label: jest.fn().mockReturnValue("Red"),
    burstFireworks: jest.fn().mockReturnValue([{ id: 1 }]),
    getFireworkLaunches: jest.fn().mockReturnValue([{ cx: 50 }]),
    build_optimistic_rose_wasm: jest.fn().mockReturnValue({ id: "temp-1", sync_status: "pending" }),
    apply_garden_cache_action_wasm: jest.fn().mockReturnValue('{"roses":[],"total":0,"page":1,"filter":"","updated_at":"now"}'),
    ...overrides,
  };
  jest.doMock(wasmPath, () => wasm);
  return wasm;
}

describe("recommend WASM wrappers", () => {
  afterEach(() => {
    jest.dontMock(wasmPath);
    jest.resetModules();
  });

  it("should return null when WASM module not available", async () => {
    const { getRecommendation } = await import("../recommend");
    const result = await getRecommendation([]);
    expect(result).toBeNull();
  });

  it("should return null for empty input", async () => {
    const { getRecommendation } = await import("../recommend");
    const result = await getRecommendation([]);
    expect(result).toBeNull();
  });

  it("calls loaded WASM exports for all wrapper functions", async () => {
    const wasm = mockWasm();
    const recommend = await import("../recommend");

    await expect(recommend.getRecommendation([{ color: "red", gratitude: "thanks" }])).resolves.toEqual({
      color_suggestion: { color: "yellow" },
    });
    await expect(recommend.analyzeTextWasm("hello")).resolves.toEqual({ emotion_label: "hope" });
    await expect(recommend.getLayout(375)).resolves.toEqual({ columns: 2 });
    await expect(recommend.filterRosesInWasm([{ color: "red" }], "red")).resolves.toEqual([{ color: "red" }]);
    await expect(recommend.validatePlantInput({ color: "red", gratitude: "thanks" })).resolves.toEqual({ valid: true });
    await expect(recommend.parseGardenResponse("{}")).resolves.toEqual({ items: [], total: 0 });
    await expect(recommend.parseRoseResponse("{}")).resolves.toEqual({ id: "r1" });
    await expect(recommend.formatDate("2026-01-01")).resolves.toEqual({ relative: "刚刚" });
    await expect(recommend.generatePetals(1, BigInt(1))).resolves.toEqual([{ left: 10 }]);
    await expect(recommend.roseToSoundParamsWasm("{}")).resolves.toEqual({ base_freq: 220 });
    await expect(recommend.computeSkyParams(23)).resolves.toEqual({ label: "夜晚" });
    await expect(recommend.generateStarParticles(1, BigInt(2))).resolves.toEqual([{ left: 20 }]);
    await expect(recommend.buildGardenUrl("http://x", 1, 20, "red")).resolves.toBe("/garden-from-wasm");
    await expect(recommend.buildPlantBody("red", "g", null, null, true)).resolves.toBe('{"from":"wasm"}');
    expect(recommend.colorEmoji("red")).toBe("R");
    expect(recommend.colorLabel("red")).toBe("Red");
    await expect(recommend.burstFireworks(50, 50, 1, 0)).resolves.toEqual([{ id: 1 }]);
    await expect(recommend.getFireworkLaunches()).resolves.toEqual([{ cx: 50 }]);
    await expect(recommend.buildOptimisticRose("{}", "temp-1", "now", "alice")).resolves.toEqual({ id: "temp-1", sync_status: "pending" });
    await expect(recommend.applyGardenCacheAction("", "{}")).resolves.toBe('{"roses":[],"total":0,"page":1,"filter":"","updated_at":"now"}');

    expect(wasm.default).toHaveBeenCalledTimes(1);
    expect(wasm.compute_layout).toHaveBeenCalledWith(JSON.stringify({
      width: 375,
      height: 0,
      safe_area_top: 0,
      safe_area_bottom: 0,
      is_web: true,
    }));
    expect(wasm.build_plant_body).toHaveBeenCalledWith("red", "g", "", "", true);
    expect(wasm.build_optimistic_rose_wasm).toHaveBeenCalledWith("{}", "temp-1", "now", "alice");
  });

  it("uses TS fallbacks when selected WASM calls throw", async () => {
    mockWasm({
      build_garden_url: jest.fn(() => { throw new Error("boom"); }),
      build_plant_body: jest.fn(() => { throw new Error("boom"); }),
      color_emoji: jest.fn(() => { throw new Error("boom"); }),
      color_label: jest.fn(() => { throw new Error("boom"); }),
      burstFireworks: jest.fn(() => { throw new Error("boom"); }),
      getFireworkLaunches: jest.fn(() => { throw new Error("boom"); }),
    });
    const recommend = await import("../recommend");

    await expect(recommend.buildGardenUrl("http://x", 2, 10, "red")).resolves.toBe(
      "http://x/api/garden?page=2&per_page=10&color=red"
    );
    await expect(recommend.buildPlantBody("red", "g", null, null, true)).resolves.toBe(
      JSON.stringify({ color: "red", gratitude: "g", anxiety: null, hope: null, is_private: true })
    );
    expect(recommend.colorEmoji("missing")).toBe("🌸");
    expect(recommend.colorLabel("missing")).toBe("missing");
    await expect(recommend.burstFireworks(0, 0, 1, 0)).resolves.toEqual([]);
    await expect(recommend.getFireworkLaunches()).resolves.toEqual([]);
  });
});
