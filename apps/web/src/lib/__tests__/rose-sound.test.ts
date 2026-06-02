import { roseToSoundParams } from "../rose-sound";
import type { Rose } from "../api";

function makeRose(overrides: Partial<Rose> = {}): Rose {
  return {
    id: "test-id",
    color: "red",
    gratitude: null,
    anxiety: null,
    hope: null,
    user_id: null,
    nickname: null,
    like_count: 0,
    ai_reply: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("roseToSoundParams", () => {
  describe("颜色 → 频率映射", () => {
    it("红玫瑰 baseFreq = 220", () => {
      expect(roseToSoundParams(makeRose({ color: "red" })).baseFreq).toBe(220);
    });
    it("白玫瑰 baseFreq = 264", () => {
      expect(roseToSoundParams(makeRose({ color: "white" })).baseFreq).toBe(264);
    });
    it("黄玫瑰 baseFreq = 198", () => {
      expect(roseToSoundParams(makeRose({ color: "yellow" })).baseFreq).toBe(198);
    });
    it("未知颜色降级到红玫瑰频率", () => {
      expect(roseToSoundParams(makeRose({ color: "purple" })).baseFreq).toBe(220);
    });
  });

  describe("字段组合 → 频率比", () => {
    it("只有感恩 → 1:1", () => {
      const p = roseToSoundParams(makeRose({ gratitude: "感谢" }));
      expect(p.fx).toBe(1); expect(p.fy).toBe(1);
    });
    it("感恩+期待 → 1:2", () => {
      const p = roseToSoundParams(makeRose({ gratitude: "感谢", hope: "期待" }));
      expect(p.fx).toBe(1); expect(p.fy).toBe(2);
    });
    it("感恩+焦虑 → 2:3", () => {
      const p = roseToSoundParams(makeRose({ gratitude: "感谢", anxiety: "焦虑" }));
      expect(p.fx).toBe(2); expect(p.fy).toBe(3);
    });
    it("焦虑+期待 → 3:5", () => {
      const p = roseToSoundParams(makeRose({ anxiety: "焦虑", hope: "期待" }));
      expect(p.fx).toBe(3); expect(p.fy).toBe(5);
    });
    it("三者俱全 → 3:4", () => {
      const p = roseToSoundParams(makeRose({ gratitude: "g", anxiety: "a", hope: "h" }));
      expect(p.fx).toBe(3); expect(p.fy).toBe(4);
    });
    it("只有期待 → 1:3", () => {
      const p = roseToSoundParams(makeRose({ hope: "期待" }));
      expect(p.fx).toBe(1); expect(p.fy).toBe(3);
    });
    it("只有焦虑 → 4:5", () => {
      const p = roseToSoundParams(makeRose({ anxiety: "焦虑" }));
      expect(p.fx).toBe(4); expect(p.fy).toBe(5);
    });
  });

  describe("点赞 → 波形", () => {
    it("0 赞 → sawtooth", () => {
      expect(roseToSoundParams(makeRose({ like_count: 0 })).waveform).toBe("sawtooth");
    });
    it("1 赞 → sawtooth", () => {
      expect(roseToSoundParams(makeRose({ like_count: 1 })).waveform).toBe("sawtooth");
    });
    it("3 赞 → triangle", () => {
      expect(roseToSoundParams(makeRose({ like_count: 3 })).waveform).toBe("triangle");
    });
    it("10 赞 → sine", () => {
      expect(roseToSoundParams(makeRose({ like_count: 10 })).waveform).toBe("sine");
    });
  });

  describe("文字长度 → 相位", () => {
    it("内容越长相位越大", () => {
      const short = roseToSoundParams(makeRose({ gratitude: "感谢" }));
      const long  = roseToSoundParams(makeRose({ gratitude: "感谢".repeat(50) }));
      expect(long.phase).toBeGreaterThan(short.phase);
    });
  });

  describe("颜色输出", () => {
    it("红玫瑰 stroke 为玫瑰粉", () => {
      expect(roseToSoundParams(makeRose({ color: "red" })).stroke).toBe("#f472b6");
    });
    it("glow 格式正确", () => {
      const p = roseToSoundParams(makeRose());
      expect(p.glow).toMatch(/^rgba\(/);
    });
  });
});
