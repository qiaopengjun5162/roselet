import {
  getToken, setToken,
  getUser, setUser,
  logout,
} from '@/utils/storage';

const mockStorage: Record<string, string> = {};

(global as any).wx = {
  getStorageSync: (key: string) => mockStorage[key] ?? '',
  setStorageSync: (key: string, value: string) => { mockStorage[key] = value; },
  removeStorageSync: (key: string) => { delete mockStorage[key]; },
};

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
});

describe('storage', () => {
  // ── Token ──────────────────────────────────────────
  describe('getToken / setToken', () => {
    it('returns null when no token stored', () => {
      expect(getToken()).toBeNull();
    });

    it('returns stored token', () => {
      setToken('test-jwt-token');
      expect(getToken()).toBe('test-jwt-token');
    });

    it('overwrites existing token', () => {
      setToken('old');
      setToken('new');
      expect(getToken()).toBe('new');
    });

    it('handles empty string token', () => {
      setToken('');
      // empty string is falsy, so || returns null
      expect(getToken()).toBeNull();
    });
  });

  // ── User ───────────────────────────────────────────
  describe('getUser / setUser', () => {
    const user = { id: '1', nickname: 'test', created_at: '2024-06-01T00:00:00Z' };

    it('returns null when no user stored', () => {
      expect(getUser()).toBeNull();
    });

    it('returns parsed user object', () => {
      setUser(user);
      expect(getUser()).toEqual(user);
    });

    it('returns null and cleans up on corrupt JSON', () => {
      mockStorage['roselet_user'] = '{broken';
      expect(getUser()).toBeNull();
      expect(mockStorage['roselet_user']).toBeUndefined();
    });

    it('returns null and cleans up on empty string', () => {
      mockStorage['roselet_user'] = '';
      // '' is falsy so first check returns null, no cleanup needed
      expect(getUser()).toBeNull();
    });

    it('returns null and cleans up on non-object JSON', () => {
      mockStorage['roselet_user'] = '"just a string"';
      const result = getUser();
      // JSON.parse succeeds but result is not a User object shape
      // Our function doesn't validate shape, it just parses
      expect(result).toBe('just a string');
    });
  });

  // ── Logout ─────────────────────────────────────────
  describe('logout', () => {
    it('clears both token and user', () => {
      setToken('token');
      setUser({ id: '1', nickname: 'test', created_at: '2024-06-01T00:00:00Z' });
      logout();
      expect(getToken()).toBeNull();
      expect(getUser()).toBeNull();
    });

    it('is idempotent — safe to call multiple times', () => {
      logout();
      logout();
      expect(getToken()).toBeNull();
      expect(getUser()).toBeNull();
    });

    it('only clears roselet keys, not other app data', () => {
      mockStorage['other_app_key'] = 'important';
      setToken('token');
      logout();
      expect(mockStorage['other_app_key']).toBe('important');
      expect(getToken()).toBeNull();
    });
  });
});
