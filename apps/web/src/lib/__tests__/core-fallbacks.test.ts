import {
  COLOR_FALLBACK,
  TIP_FALLBACKS,
  audioPlaybackPolicyFallback,
  buildGardenUrlFallback,
  buildPlantBodyFallback,
  colorEmojiFallback,
  colorLabelFallback,
  colorOptionsFallback,
} from "@roselet/core";

/**
 * Behavioural fallbacks for when Rust WASM cannot load. The expected strings
 * are the same ones pinned by crates/recommend/src/api_client.rs and
 * crates/recommend/src/audio.rs; crates/recommend/src/contract.rs guards the
 * corresponding source markers so neither side can drift alone.
 */
describe("shared WASM-unavailable fallbacks", () => {
  it("exposes the Rust colours in Rust order and returns a copy", () => {
    expect(COLOR_FALLBACK).toEqual([
      { id: "red", label: "红玫瑰", emoji: "🌹" },
      { id: "white", label: "白玫瑰", emoji: "🤍" },
      { id: "yellow", label: "黄玫瑰", emoji: "💛" },
    ]);
    expect(colorOptionsFallback()).toEqual(COLOR_FALLBACK);
    expect(colorOptionsFallback()).not.toBe(COLOR_FALLBACK);
    expect(colorOptionsFallback()[0]).not.toBe(COLOR_FALLBACK[0]);
  });

  it("falls back to the first registered colour for unknown ids", () => {
    expect(colorEmojiFallback("missing")).toBe("🌹");
    expect(colorLabelFallback("missing")).toBe("红玫瑰");
    expect(colorEmojiFallback("red")).toBe("🌹");
    expect(colorLabelFallback("white")).toBe("白玫瑰");
    expect(colorLabelFallback("yellow")).toBe("黄玫瑰");
  });

  it("provides a Rust-backed tip for every context", () => {
    expect(Object.keys(TIP_FALLBACKS).sort()).toEqual(["garden", "home", "login", "plant"]);
    for (const tips of Object.values(TIP_FALLBACKS)) {
      expect(tips.length).toBeGreaterThan(0);
      expect(tips[0].text.length).toBeGreaterThan(0);
    }
  });

  it("only stops background audio for foreground playback", () => {
    expect(audioPlaybackPolicyFallback({ starting: "foreground", background_playing: true })).toEqual({ stop_background: true });
    expect(audioPlaybackPolicyFallback({ starting: "foreground", background_playing: false })).toEqual({ stop_background: false });
    expect(audioPlaybackPolicyFallback({ starting: "effect", background_playing: true })).toEqual({ stop_background: false });
    expect(audioPlaybackPolicyFallback({ starting: "background", background_playing: true })).toEqual({ stop_background: false });
  });

  it("omits empty and all colour filters like api_client.rs", () => {
    expect(buildGardenUrlFallback("http://x", 1, 20)).toBe("http://x/api/garden?page=1&per_page=20");
    expect(buildGardenUrlFallback("http://x", 1, 20, "")).toBe("http://x/api/garden?page=1&per_page=20");
    expect(buildGardenUrlFallback("http://x", 2, 10, "all")).toBe("http://x/api/garden?page=2&per_page=10");
    expect(buildGardenUrlFallback("http://x", 2, 10, "red")).toBe("http://x/api/garden?page=2&per_page=10&color=red");
  });

  it("skips blank plant fields instead of emitting null", () => {
    expect(buildPlantBodyFallback({ color: "red" })).toBe('{"color":"red"}');
    expect(buildPlantBodyFallback({ color: "red", gratitude: "g", anxiety: null, hope: null, is_private: true })).toBe(
      '{"color":"red","gratitude":"g","is_private":true}'
    );
    expect(buildPlantBodyFallback({ color: "white", gratitude: "", hope: "h", is_private: false, recipient_nickname: "" })).toBe(
      '{"color":"white","hope":"h"}'
    );
  });

  it("includes private and recipient flags only when set", () => {
    expect(buildPlantBodyFallback({ color: "yellow", is_private: true, recipient_nickname: "小红" })).toBe(
      '{"color":"yellow","is_private":true,"recipient_nickname":"小红"}'
    );
    expect(buildPlantBodyFallback({ color: "red", gratitude: "g", anxiety: "a", hope: "h" })).toBe(
      '{"color":"red","gratitude":"g","anxiety":"a","hope":"h"}'
    );
  });
});
