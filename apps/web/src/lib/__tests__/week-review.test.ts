/**
 * 一周回顾的降级实现（Rust WASM 不可用时走这里）。
 *
 * 这里的用例与 `crates/recommend/src/week.rs` 的单测一一对应：
 * 两边口径一旦漂移，「还剩几天」和「这一周几句」就会给出不同答案。
 */
import {
  WEEK_DAYS,
  buildWeekReviewFallback,
  parseCreatedAtMs,
  weekFirstRoseLine,
  weekKindsLine,
  weekPendingHeadline,
  weekReadyHeadline,
} from "@roselet/core";

const NOW = Date.parse("2026-11-19T00:00:00Z");

type Rose = {
  id: string;
  created_at: string;
  gratitude?: string | null;
  anxiety?: string | null;
  hope?: string | null;
};

function rose(
  id: string,
  createdAt: string,
  gratitude: string | null = null,
  hope: string | null = null,
): Rose {
  return { id, created_at: createdAt, gratitude, hope };
}

describe("parseCreatedAtMs：后端可能给的几种时间格式", () => {
  it("认 RFC3339 / 无时区 / 带毫秒 / 空格分隔", () => {
    expect(parseCreatedAtMs("2026-11-19T00:00:00Z")).toBe(NOW);
    expect(parseCreatedAtMs("2026-11-19T00:00:00")).toBe(NOW);
    expect(parseCreatedAtMs("2026-11-19T00:00:00.000")).toBe(NOW);
    expect(parseCreatedAtMs("2026-11-19 00:00:00")).toBe(NOW);
    expect(parseCreatedAtMs("2026-11-19T08:00:00+08:00")).toBe(NOW);
  });

  it("空串和乱码返回 null，不抛错", () => {
    expect(parseCreatedAtMs("")).toBeNull();
    expect(parseCreatedAtMs("not a date")).toBeNull();
  });
});

describe("尚不满一周：只倒计时，不假装给出回顾", () => {
  const review = buildWeekReviewFallback(
    [rose("r1", "2026-11-16T00:00:00Z", "谢谢楼下的猫")],
    NOW,
  );

  it("算出还差几天、第 1 朵几天前", () => {
    expect(review.total).toBe(1);
    expect(review.days_since_first).toBe(3);
    expect(review.days_until_ready).toBe(WEEK_DAYS - 3);
    expect(review.ready).toBe(false);
  });

  it("这一周的三类计数照实记", () => {
    expect(review.in_week).toBe(1);
    expect(review.counts.gratitude).toBe(1);
    expect(review.quotes).toHaveLength(1);
    expect(review.quotes[0].text).toBe("谢谢楼下的猫");
  });
});

describe("满一周：摊开这一周写过的话", () => {
  const review = buildWeekReviewFallback(
    [
      rose("new", "2026-11-18T00:00:00Z", null, "想学陶艺"),
      rose("old", "2026-11-12T00:00:00Z", "邻居帮我搬花"),
    ],
    NOW,
  );

  it("ready 且不再倒计时", () => {
    expect(review.ready).toBe(true);
    expect(review.days_until_ready).toBe(0);
    expect(review.days_since_first).toBe(WEEK_DAYS);
    expect(review.in_week).toBe(2);
  });

  it("原话按新→旧排，方便一眼看到最近写的", () => {
    expect(review.quotes.map((q) => q.id)).toEqual(["new", "old"]);
  });
});

describe("边界", () => {
  it("空花圃不谎称已到一周", () => {
    const review = buildWeekReviewFallback([], NOW);
    expect(review.total).toBe(0);
    expect(review.ready).toBe(false);
    expect(review.days_until_ready).toBe(WEEK_DAYS);
    expect(review.quotes).toEqual([]);
  });

  it("更早的玫瑰算总数，但不算这一周", () => {
    const review = buildWeekReviewFallback(
      [
        rose("a", "2026-10-01T00:00:00Z", "很早的一句"),
        rose("b", "2026-11-19T00:00:00Z", null, "今天的一句"),
      ],
      NOW,
    );
    expect(review.total).toBe(2);
    expect(review.in_week).toBe(1);
    expect(review.quotes.map((q) => q.id)).toEqual(["b"]);
    expect(review.days_since_first).toBe(49);
  });

  it("第 8 天回来仍看得到第一周写下的原话", () => {
    // 第 0 天种下、第 8 天回来：按「最近 7 天」算正好把那朵挤出去，
    // 页面会在承诺兑现的那一刻变成空的。
    const review = buildWeekReviewFallback(
      [rose("only", "2026-11-11T00:00:00Z", "谢谢楼下的猫")],
      NOW,
    );
    expect(review.ready).toBe(true);
    expect(review.days_since_first).toBe(8);
    expect(review.in_week).toBe(1);
    expect(review.quotes).toHaveLength(1);
  });

  it("三周后回来只算最近 7 天，不把旧账翻出来", () => {
    const review = buildWeekReviewFallback(
      [
        rose("old", "2026-10-30T00:00:00Z", "很久以前"),
        rose("new", "2026-11-18T00:00:00Z", "昨天"),
      ],
      NOW,
    );
    expect(review.total).toBe(2);
    expect(review.in_week).toBe(1);
    expect(review.quotes.map((q) => q.id)).toEqual(["new"]);
  });

  it("一朵玫瑰写满三栏，就出三条，三栏各计一次", () => {
    const review = buildWeekReviewFallback(
      [{ id: "r", created_at: "2026-11-18T00:00:00Z", gratitude: "一", anxiety: "二", hope: "三" }],
      NOW,
    );
    expect(review.quotes).toHaveLength(3);
    expect(review.counts).toEqual({ gratitude: 1, anxiety: 1, hope: 1 });
  });

  it("只有空格的正文不算一句", () => {
    const review = buildWeekReviewFallback([rose("r", "2026-11-18T00:00:00Z", "   ")], NOW);
    expect(review.quotes).toEqual([]);
    expect(review.counts.gratitude).toBe(0);
  });

  it("时钟飘到未来的时间按 0 天算，不出现负数", () => {
    const review = buildWeekReviewFallback(
      [rose("r", "2026-11-25T00:00:00Z", "时钟飘了")],
      NOW,
    );
    expect(review.days_since_first).toBe(0);
    expect(review.quotes[0].age_days).toBe(0);
  });

  it("时间坏掉的玫瑰不参与天数，但仍在总数里", () => {
    const review = buildWeekReviewFallback([rose("bad", "??", "丢了时间")], NOW);
    expect(review.total).toBe(1);
    expect(review.ready).toBe(false);
    expect(review.quotes).toEqual([]);
  });
});

describe("页面文案：数字要读得通，不能出病句", () => {
  it("标题按有没有新玫瑰分两种说法", () => {
    expect(weekReadyHeadline(3)).toBe("这一周，你种下了 3 朵玫瑰");
    expect(weekReadyHeadline(0)).toBe("这一周没有新的玫瑰");
  });

  it("「还有 1 天」不写成「还有 1 天」以外的复数形式", () => {
    expect(weekPendingHeadline(1)).toBe("还有 1 天");
    expect(weekPendingHeadline(4)).toBe("还有 4 天");
  });

  it("第一朵是今天时不写「0 天前」", () => {
    expect(weekFirstRoseLine(0)).toBe("第 1 朵是今天种的。");
    expect(weekFirstRoseLine(9)).toBe("第 1 朵是 9 天前种的。");
  });

  it("三类计数只显示写过的，不为 0 的类别凑数", () => {
    expect(weekKindsLine({ gratitude: 2, anxiety: 1, hope: 0 })).toBe("感恩 2 · 尖刺 1");
    expect(weekKindsLine({ gratitude: 0, anxiety: 3, hope: 0 })).toBe("尖刺 3");
  });

  it("三类都空时返回空串，交给调用方说「总共 N 朵」", () => {
    expect(weekKindsLine({ gratitude: 0, anxiety: 0, hope: 0 })).toBe("");
  });
});
