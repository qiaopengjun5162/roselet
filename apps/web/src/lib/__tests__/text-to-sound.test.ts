import { analyzeTextWasm } from "@/lib/recommend";
import { analyzeTextAsync } from "../text-to-sound";

jest.mock("@/lib/recommend", () => ({
  analyzeTextWasm: jest.fn(),
}));

describe("text-to-sound", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns neutral params for blank text", async () => {
    await expect(analyzeTextAsync("   ")).resolves.toMatchObject({
      fx: 1,
      fy: 1,
      waveform: "sine",
      baseFreq: 220,
      emotionLabel: "○ 中性",
      intensity: 0,
    });
    expect(analyzeTextWasm).not.toHaveBeenCalled();
  });

  it("maps WASM emotion fields with defaults", async () => {
    (analyzeTextWasm as jest.Mock).mockResolvedValue({
      fx: 1.5,
      base_freq: 330,
      emotion_label: "希望",
    });

    await expect(analyzeTextAsync("期待明天")).resolves.toEqual({
      fx: 1.5,
      fy: 1,
      waveform: "sine",
      baseFreq: 330,
      phase: 0,
      stroke: "#94a3b8",
      glow: "rgba(148,163,184,0.4)",
      emotionLabel: "希望",
      intensity: 0,
    });
  });

  it("returns neutral params when WASM is unavailable", async () => {
    (analyzeTextWasm as jest.Mock).mockResolvedValue(null);

    await expect(analyzeTextAsync("hello")).resolves.toMatchObject({
      emotionLabel: "○ 中性",
      baseFreq: 220,
    });
  });
});
