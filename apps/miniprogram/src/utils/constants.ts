export const COLOR_EMOJI: Record<string, string> = { red: '🌹', white: '🤍', yellow: '💛' };
export const COLOR_LABEL: Record<string, string> = { red: '红玫瑰', white: '白玫瑰', yellow: '黄玫瑰' };

export const COLOR_FILTERS = [
  { value: '', label: '全部' },
  { value: 'red', label: '红' },
  { value: 'white', label: '白' },
  { value: 'yellow', label: '黄' },
] as const;

export const COLOR_OPTIONS = [
  { id: 'red', label: '红玫瑰', emoji: '🌹' },
  { id: 'white', label: '白玫瑰', emoji: '🤍' },
  { id: 'yellow', label: '黄玫瑰', emoji: '💛' },
] as const;
