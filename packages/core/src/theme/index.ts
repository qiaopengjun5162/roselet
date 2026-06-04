/** Roselet 全局设计令牌 — Web 和小程序统一引用 */

export const theme = {
  color: {
    bg: '#0a0b14',
    nav: 'rgba(15, 8, 30, 0.92)',
    card: 'rgba(255, 255, 255, 0.04)',
    cardBorder: 'rgba(255, 255, 255, 0.07)',
    rose: '#f43f5e',
    roseGlow: 'rgba(244, 63, 94, 0.35)',
    purple: '#a78bfa',
    text: '#e2e8f0',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    glowPurple: 'rgba(139, 92, 246, 0.06)',
    glowIndigo: 'rgba(79, 70, 229, 0.08)',
  },
  radius: {
    card: '12px',
    button: '50px',
  },
} as const;
