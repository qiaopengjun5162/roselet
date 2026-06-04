/**
 * API 层单元测试 —— 验证每个 API 函数正确构造请求参数。
 * 通过 mock request 模块来隔离测试，不依赖网络。
 */
import {
  register, getGarden, getRose,
  createRose, getUserProfile, toggleLike,
} from '@/api';

// Mock request module
const mockRequest = jest.fn();
jest.mock('@/utils/request', () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

beforeEach(() => {
  mockRequest.mockReset();
});

describe('api', () => {
  describe('register', () => {
    it('calls POST /api/auth/register with nickname', async () => {
      mockRequest.mockResolvedValue({ token: 't', user: { id: '1', nickname: 'foo', created_at: '' } });
      await register('foo');
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/auth/register',
        { method: 'POST', data: { nickname: 'foo' } }
      );
    });
  });

  describe('getGarden', () => {
    it('calls GET with default pagination', async () => {
      mockRequest.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 });
      await getGarden();
      expect(mockRequest).toHaveBeenCalledWith('/api/garden?page=1&per_page=20');
    });

    it('appends color filter when provided', async () => {
      mockRequest.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 });
      await getGarden(1, 20, 'red');
      expect(mockRequest).toHaveBeenCalledWith('/api/garden?page=1&per_page=20&color=red');
    });

    it('uses custom page and perPage', async () => {
      mockRequest.mockResolvedValue({ data: [], total: 0, page: 3, per_page: 10 });
      await getGarden(3, 10);
      expect(mockRequest).toHaveBeenCalledWith('/api/garden?page=3&per_page=10');
    });

    it('omits color when undefined', async () => {
      mockRequest.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 });
      await getGarden(1, 20, undefined);
      expect(mockRequest).toHaveBeenCalledWith('/api/garden?page=1&per_page=20');
    });
  });

  describe('getRose', () => {
    it('calls GET /api/rose/:id', async () => {
      mockRequest.mockResolvedValue({ id: 'abc', color: 'red' });
      await getRose('abc');
      expect(mockRequest).toHaveBeenCalledWith('/api/rose/abc');
    });
  });

  describe('createRose', () => {
    it('calls POST /api/rose with auth', async () => {
      mockRequest.mockResolvedValue({ id: '1', color: 'red' });
      await createRose({ color: 'red', gratitude: 'thanks' });
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/rose',
        { method: 'POST', data: { color: 'red', gratitude: 'thanks' }, auth: true }
      );
    });
  });

  describe('getUserProfile', () => {
    it('calls GET /api/user/profile with auth', async () => {
      mockRequest.mockResolvedValue({ user: { id: '1' }, total_roses: 5 });
      await getUserProfile();
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/user/profile',
        { auth: true }
      );
    });
  });

  describe('toggleLike', () => {
    it('calls POST /api/rose/:id/like with auth', async () => {
      mockRequest.mockResolvedValue({ liked: true, like_count: 3 });
      await toggleLike('rose-1');
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/rose/rose-1/like',
        { method: 'POST', auth: true }
      );
    });
  });
});
