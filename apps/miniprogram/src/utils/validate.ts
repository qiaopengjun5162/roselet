/**
 * 输入安全校验工具。
 * 防御场景：空字节注入、超长字符串、控制字符、XSS 常见向量。
 */

/** 昵称：1-20 个可见字符，禁止控制字符和 HTML 标签 */
export function validateNickname(input: string): { valid: true; value: string } | { valid: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { valid: false, error: '昵称不能为空' };
  if (trimmed.length > 20) return { valid: false, error: '昵称最多 20 字' };
  // 拒绝含控制字符（换行、制表等）的输入
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return { valid: false, error: '昵称含非法字符' };
  // 拒绝纯 HTML 标签
  if (/<[^>]*>/.test(trimmed)) return { valid: false, error: '昵称含非法字符' };
  return { valid: true, value: trimmed };
}

/** 玫瑰内容：每个字段 1-500 字，禁止空字节 */
export function validateRoseField(input: string): { valid: true; value: string } | { valid: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { valid: true, value: '' }; // 允许空（字段可选）
  if (trimmed.length > 500) return { valid: false, error: '内容超过 500 字限制' };
  if (/\x00/.test(trimmed)) return { valid: false, error: '内容含非法字符' };
  return { valid: true, value: trimmed };
}

/** 至少填写一个字段 */
export function validateRoseForm(gratitude: string, anxiety: string, hope: string): true | string {
  if (!gratitude.trim() && !anxiety.trim() && !hope.trim()) return '至少填写一项';
  return true;
}
