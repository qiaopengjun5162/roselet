/**
 * API 层单元测试 —— 验证每个 API 函数正确构造请求参数。
 * 通过 mock request 模块来隔离测试，不依赖网络。
 */
import {
  register, getGarden, getRose,
  createRose, updateRose, deleteRose, getMyRoses,
  getUserProfile, toggleLike, getHealth, submitFeedback,
} from '@/api';

const mockRequest = jest.fn();
const mockBuildPlantBody = jest.fn();
const mockCacheGardenPage = jest.fn();
const mockCreateOptimisticGardenRose = jest.fn();
const mockConfirmOptimisticGardenRose = jest.fn();
const mockRejectOptimisticGardenRose = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@/utils/request', () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

jest.mock('@/utils/storage', () => ({
  getUser: () => mockGetUser(),
}));

jest.mock('@/utils/wasm', () => ({
  buildPlantBody: (...args: unknown[]) => mockBuildPlantBody(...args),
}));

jest.mock('@/utils/garden-cache', () => ({
  cacheGardenPage: (...args: unknown[]) => mockCacheGardenPage(...args),
  createOptimisticGardenRose: (...args: unknown[]) => mockCreateOptimisticGardenRose(...args),
  confirmOptimisticGardenRose: (...args: unknown[]) => mockConfirmOptimisticGardenRose(...args),
  rejectOptimisticGardenRose: (...args: unknown[]) => mockRejectOptimisticGardenRose(...args),
}));

beforeEach(() => {
  mockRequest.mockReset();
  mockBuildPlantBody.mockReset().mockResolvedValue('{"color":"red","gratitude":"thanks"}');
  mockCacheGardenPage.mockReset().mockResolvedValue(null);
  mockCreateOptimisticGardenRose.mockReset().mockResolvedValue('temp-1');
  mockConfirmOptimisticGardenRose.mockReset().mockResolvedValue(undefined);
  mockRejectOptimisticGardenRose.mockReset().mockResolvedValue(undefined);
  mockGetUser.mockReset().mockReturnValue({ id: 'u1', nickname: 'alice', created_at: '' });
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
      const response = { data: [], total: 0, page: 1, per_page: 20 };
      mockRequest.mockResolvedValue(response);
      await getGarden();
      expect(mockRequest).toHaveBeenCalledWith('/api/garden?page=1&per_page=20');
      expect(mockCacheGardenPage).toHaveBeenCalledWith(response);
    });

    it('appends color filter when provided', async () => {
      mockRequest.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 });
      await getGarden(1, 20, 'red');
      expect(mockRequest).toHaveBeenCalledWith('/api/garden?page=1&per_page=20&color=red');
      expect(mockCacheGardenPage).not.toHaveBeenCalled();
    });

    it('uses custom page and perPage', async () => {
      mockRequest.mockResolvedValue({ data: [], total: 0, page: 3, per_page: 10 });
      await getGarden(3, 10);
      expect(mockRequest).toHaveBeenCalledWith('/api/garden?page=3&per_page=10');
      expect(mockCacheGardenPage).not.toHaveBeenCalled();
    });

    it('omits color when undefined', async () => {
      mockRequest.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 });
      await getGarden(1, 20, undefined);
      expect(mockRequest).toHaveBeenCalledWith('/api/garden?page=1&per_page=20');
    });
  });

  describe('getRose', () => {
    it('calls GET /api/rose/:id with auth for private rose owner access', async () => {
      mockRequest.mockResolvedValue({ id: 'abc', color: 'red' });
      await getRose('abc');
      expect(mockRequest).toHaveBeenCalledWith('/api/rose/abc', { auth: true });
    });
  });

  describe('createRose', () => {
    it('calls POST /api/rose with auth', async () => {
      const created = { id: '1', color: 'red' };
      mockRequest.mockResolvedValue(created);
      await createRose({ color: 'red', gratitude: 'thanks' });
      expect(mockBuildPlantBody).toHaveBeenCalledWith({ color: 'red', gratitude: 'thanks' });
      expect(mockCreateOptimisticGardenRose).toHaveBeenCalledWith('{"color":"red","gratitude":"thanks"}', 'alice');
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/rose',
        { method: 'POST', data: '{"color":"red","gratitude":"thanks"}', auth: true }
      );
      expect(mockConfirmOptimisticGardenRose).toHaveBeenCalledWith('temp-1', created);
    });

    it('preserves private flag in request data', async () => {
      mockRequest.mockResolvedValue({ id: '1', color: 'red', is_private: true });
      mockBuildPlantBody.mockResolvedValue('{"color":"red","gratitude":"secret","is_private":true}');
      await createRose({ color: 'red', gratitude: 'secret', is_private: true });
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/rose',
        { method: 'POST', data: '{"color":"red","gratitude":"secret","is_private":true}', auth: true }
      );
    });

    it('rejects optimistic cache when create request fails', async () => {
      mockRequest.mockRejectedValue(new Error('network'));
      await expect(createRose({ color: 'red', gratitude: 'thanks' })).rejects.toThrow('network');
      expect(mockRejectOptimisticGardenRose).toHaveBeenCalledWith('temp-1');
      expect(mockConfirmOptimisticGardenRose).not.toHaveBeenCalled();
    });

    it('uses empty nickname when user is not logged in', async () => {
      mockGetUser.mockReturnValue(null);
      mockRequest.mockResolvedValue({ id: '1', color: 'red' });
      await createRose({ color: 'red', gratitude: 'thanks' });
      expect(mockCreateOptimisticGardenRose).toHaveBeenCalledWith('{"color":"red","gratitude":"thanks"}', '');
    });

    it('still creates rose when optimistic cache is unavailable', async () => {
      const created = { id: '1', color: 'red' };
      mockCreateOptimisticGardenRose.mockResolvedValue(null);
      mockRequest.mockResolvedValue(created);
      await expect(createRose({ color: 'red', gratitude: 'thanks' })).resolves.toEqual(created);
      expect(mockConfirmOptimisticGardenRose).toHaveBeenCalledWith(null, created);
    });
  });

  describe('updateRose', () => {
    it('calls PUT /api/rose/:id with auth', async () => {
      mockRequest.mockResolvedValue({ id: '1', color: 'yellow' });
      await updateRose('1', { color: 'yellow', hope: 'new' });
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/rose/1',
        { method: 'PUT', data: { color: 'yellow', hope: 'new' }, auth: true }
      );
    });
  });

  describe('deleteRose', () => {
    it('calls DELETE /api/rose/:id with auth', async () => {
      mockRequest.mockResolvedValue(undefined);
      await deleteRose('1');
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/rose/1',
        { method: 'DELETE', auth: true }
      );
    });
  });

  describe('getMyRoses', () => {
    it('calls GET /api/my/roses with auth and pagination', async () => {
      mockRequest.mockResolvedValue({ data: [], total: 0, page: 2, per_page: 5 });
      await getMyRoses(2, 5);
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/my/roses?page=2&per_page=5',
        { auth: true }
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

  describe('submitFeedback', () => {
    it('returns true when request succeeds', async () => {
      mockRequest.mockResolvedValue({ id: 1 });
      await expect(submitFeedback('hello')).resolves.toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        '/api/feedback',
        { method: 'POST', auth: false, data: { content: 'hello' } }
      );
    });

    it('returns false when request fails', async () => {
      mockRequest.mockRejectedValue(new Error('network'));
      await expect(submitFeedback('hello')).resolves.toBe(false);
    });
  });

  describe('getHealth', () => {
    it('calls GET /health', async () => {
      mockRequest.mockResolvedValue({ status: 'ok', database: 'healthy', version: '0.1.0' });
      await getHealth();
      expect(mockRequest).toHaveBeenCalledWith('/health');
    });
  });
});
