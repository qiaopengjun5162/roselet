/** 玫瑰颜色 → emoji 映射 */
export const COLOR_EMOJI: Record<string, string> = {
  red: '🌹',
  white: '🤍',
  yellow: '💛',
};

/** 玫瑰颜色 → 中文标签 */
export const COLOR_LABEL: Record<string, string> = {
  red: '红玫瑰',
  white: '白玫瑰',
  yellow: '黄玫瑰',
};

/** 颜色筛选选项（花圃页共用） */
export const COLOR_FILTERS = [
  { value: '', label: '全部' },
  { value: 'red', label: '红' },
  { value: 'white', label: '白' },
  { value: 'yellow', label: '黄' },
] as const;

/** 种花页颜色卡片 */
export const COLOR_OPTIONS = [
  { id: 'red', label: '红玫瑰', emoji: '🌹' },
  { id: 'white', label: '白玫瑰', emoji: '🤍' },
  { id: 'yellow', label: '黄玫瑰', emoji: '💛' },
] as const;
