import { LocalKeywordAnalyzer } from "../text-to-sound";

const analyzer = new LocalKeywordAnalyzer();

describe("LocalKeywordAnalyzer", () => {
  describe("空输入", () => {
    it("空字符串返回 neutral", () => {
      const p = analyzer.analyze("");
      expect(p.emotionLabel).toBe("○ 中性");
      expect(p.intensity).toBe(0);
    });

    it("纯空白返回 neutral", () => {
      const p = analyzer.analyze("   ");
      expect(p.emotionLabel).toBe("○ 中性");
    });
  });

  describe("感恩情绪", () => {
    it("识别感恩关键词", () => {
      const p = analyzer.analyze("今天很开心，感谢家人的陪伴");
      expect(p.emotionLabel).toBe("🌹 感恩");
      expect(p.waveform).toBe("sine");
      expect(p.intensity).toBeGreaterThan(0);
    });

    it("感恩 stroke 为玫瑰粉", () => {
      const p = analyzer.analyze("感恩每一天");
      expect(p.stroke).toBe("#f472b6");
    });

    it("多个感恩词 intensity 更高", () => {
      const low  = analyzer.analyze("不错");
      const high = analyzer.analyze("感恩感谢幸福开心快乐");
      expect(high.intensity).toBeGreaterThan(low.intensity);
    });
  });

  describe("焦虑情绪", () => {
    it("识别焦虑关键词", () => {
      const p = analyzer.analyze("最近压力很大，有点焦虑");
      expect(p.emotionLabel).toBe("🌵 焦虑");
      expect(p.waveform).toBe("sawtooth");
    });

    it("焦虑 stroke 为冰蓝", () => {
      const p = analyzer.analyze("焦虑难受");
      expect(p.stroke).toBe("#38bdf8");
    });

    it("高强度焦虑 fy 增大", () => {
      const low  = analyzer.analyze("有点累");
      const high = analyzer.analyze("焦虑崩溃压力担心紧张害怕");
      expect(high.fy).toBeGreaterThanOrEqual(low.fy);
    });
  });

  describe("期待情绪", () => {
    it("识别期待关键词", () => {
      const p = analyzer.analyze("很期待下周的旅行，希望能实现梦想");
      expect(p.emotionLabel).toBe("🌱 期待");
      expect(p.waveform).toBe("triangle");
    });

    it("期待 stroke 为花苞紫", () => {
      const p = analyzer.analyze("期待未来");
      expect(p.stroke).toBe("#a78bfa");
    });
  });

  describe("通用属性", () => {
    it("intensity 始终在 0~1 范围内", () => {
      for (const text of ["", "感恩", "焦虑崩溃害怕压力", "期待梦想目标"]) {
        const p = analyzer.analyze(text);
        expect(p.intensity).toBeGreaterThanOrEqual(0);
        expect(p.intensity).toBeLessThanOrEqual(1);
      }
    });

    it("glow 始终以 rgba( 开头", () => {
      for (const text of ["", "感恩", "焦虑", "期待"]) {
        const p = analyzer.analyze(text);
        expect(p.glow).toMatch(/^rgba\(/);
      }
    });

    it("文字越长 phase 越大（同一情绪）", () => {
      const short = analyzer.analyze("感恩");
      const long  = analyzer.analyze("感恩".repeat(60));
      expect(long.phase).toBeGreaterThan(short.phase);
    });

    it("无匹配关键词时不崩溃", () => {
      expect(() => analyzer.analyze("今天吃了一碗面")).not.toThrow();
    });
  });
});
