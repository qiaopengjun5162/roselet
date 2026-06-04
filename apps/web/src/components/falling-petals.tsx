"use client";

/**
 * 玫瑰花瓣飘落动效 — 纯 CSS 实现，零 JS 开销
 * 12 枚随机大小/速度/位置的花瓣 emoji，无限循环飘落
 */
export function FallingPetals() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => {
        const size = 16 + Math.floor(i * 3.4) % 20;   // 16-36px
        const left = (i * 8.7 + 3) % 100;               // 散布全屏
        const delay = (i * 1.7) % 8;                     // 错开起始时间
        const duration = 8 + (i * 1.3) % 6;              // 8-14s 不等
        const sway = 20 + (i * 7) % 40;                  // 左右摆动幅度
        const emojis = ["🌸", "🌺", "🌷", "💮", "🏵️", "🌼", "✿", "❀"];
        const emoji = emojis[i % emojis.length];

        return (
          <span
            key={i}
            className="absolute block"
            style={{
              left: `${left}%`,
              top: "-5%",
              fontSize: `${size}px`,
              opacity: 0.25 + (i % 3) * 0.08,
              animation: `petal-fall-${i} ${duration}s ${delay}s ease-in infinite`,
              filter: `blur(${i % 2 === 0 ? "0.5px" : "0"})`,
            }}
          >
            {emoji}
            <style>{`
              @keyframes petal-fall-${i} {
                0%   { transform: translateY(0)     translateX(0)        rotate(0deg);   opacity: 0; }
                10%  { opacity: 0.3; }
                30%  { transform: translateY(30vh)  translateX(${sway}px)  rotate(${120 + i * 30}deg); }
                60%  { transform: translateY(60vh)  translateX(-${sway * 0.6}px) rotate(${240 + i * 45}deg); }
                85%  { opacity: 0.25; }
                100% { transform: translateY(105vh) translateX(${sway * 0.4}px) rotate(${360 + i * 60}deg); opacity: 0; }
              }
            `}</style>
          </span>
        );
      })}
    </div>
  );
}
