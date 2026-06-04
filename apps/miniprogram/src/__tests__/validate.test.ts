import { validateNickname, validateRoseField, validateRoseForm } from '@/utils/validate';

describe('validateNickname', () => {
  it('accepts valid nickname', () => {
    expect(validateNickname('小明')).toEqual({ valid: true, value: '小明' });
  });

  it('trims whitespace', () => {
    expect(validateNickname('  你好  ')).toEqual({ valid: true, value: '你好' });
  });

  it('rejects empty string', () => {
    expect(validateNickname('')).toEqual({ valid: false, error: '昵称不能为空' });
  });

  it('rejects whitespace-only', () => {
    expect(validateNickname('   ')).toEqual({ valid: false, error: '昵称不能为空' });
  });

  it('rejects nickname over 20 chars', () => {
    expect(validateNickname('A'.repeat(21))).toEqual({ valid: false, error: '昵称最多 20 字' });
  });

  it('accepts exactly 20 chars', () => {
    const name = 'A'.repeat(20);
    expect(validateNickname(name)).toEqual({ valid: true, value: name });
  });

  it('rejects control characters (null byte)', () => {
    expect(validateNickname('hello\x00world').valid).toBe(false);
  });

  it('rejects newline injection', () => {
    expect(validateNickname('hello\nworld').valid).toBe(false);
  });

  it('rejects HTML tag injection', () => {
    expect(validateNickname('<script>alert(1)</script>').valid).toBe(false);
  });

  it('rejects img tag', () => {
    expect(validateNickname('<img src=x onerror=alert(1)>').valid).toBe(false);
  });
});

describe('validateRoseField', () => {
  it('accepts valid content', () => {
    expect(validateRoseField('今天很开心')).toEqual({ valid: true, value: '今天很开心' });
  });

  it('returns empty string for whitespace-only (field optional)', () => {
    expect(validateRoseField('   ')).toEqual({ valid: true, value: '' });
  });

  it('rejects content over 500 chars', () => {
    expect(validateRoseField('A'.repeat(501))).toEqual({ valid: false, error: '内容超过 500 字限制' });
  });

  it('accepts exactly 500 chars', () => {
    const content = 'A'.repeat(500);
    expect(validateRoseField(content)).toEqual({ valid: true, value: content });
  });

  it('rejects null byte injection', () => {
    expect(validateRoseField('hello\x00world').valid).toBe(false);
  });
});

describe('validateRoseForm', () => {
  it('requires at least one non-empty field', () => {
    expect(validateRoseForm('', '', '')).toBe('至少填写一项');
    expect(validateRoseForm('   ', '', '')).toBe('至少填写一项');
  });

  it('passes when gratitude is filled', () => {
    expect(validateRoseForm('thanks', '', '')).toBe(true);
  });

  it('passes when anxiety is filled', () => {
    expect(validateRoseForm('', 'worried', '')).toBe(true);
  });

  it('passes when hope is filled', () => {
    expect(validateRoseForm('', '', 'hope')).toBe(true);
  });

  it('passes when all fields filled', () => {
    expect(validateRoseForm('a', 'b', 'c')).toBe(true);
  });
});
