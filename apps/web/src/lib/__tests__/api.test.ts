const mockBuildPlantBody = jest.fn();
const mockBuildGardenUrl = jest.fn();
const mockCreateOptimisticGardenRose = jest.fn();
const mockConfirmOptimisticGardenRose = jest.fn();
const mockRejectOptimisticGardenRose = jest.fn();
const mockCacheGardenPage = jest.fn();

jest.mock("@/lib/recommend", () => ({
  buildPlantBody: (...args: unknown[]) => mockBuildPlantBody(...args),
  buildGardenUrl: (...args: unknown[]) => mockBuildGardenUrl(...args),
}));

jest.mock("@/lib/garden-cache", () => ({
  createOptimisticGardenRose: (...args: unknown[]) => mockCreateOptimisticGardenRose(...args),
  confirmOptimisticGardenRose: (...args: unknown[]) => mockConfirmOptimisticGardenRose(...args),
  rejectOptimisticGardenRose: (...args: unknown[]) => mockRejectOptimisticGardenRose(...args),
  cacheGardenPage: (...args: unknown[]) => mockCacheGardenPage(...args),
}));

import {
  createRose,
  deactivateAccount,
  getGarden,
  getRose,
  updateRose,
  deleteRose,
  setToken,
  setRefreshToken,
  setUser,
  getUser,
  logout,
  refreshAccessToken,
  getHealth,
  submitFeedback,
} from "../api";

global.fetch = jest.fn();

describe("API Client", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
    mockBuildPlantBody.mockImplementation(
      async (color: string, gratitude: string | null, anxiety: string | null, hope: string | null, isPrivate: boolean) => JSON.stringify({
        color,
        gratitude,
        anxiety,
        hope,
        is_private: isPrivate,
      }),
    );
    mockBuildGardenUrl.mockImplementation(
      async (baseUrl: string, page: number, perPage: number, color?: string) => `${baseUrl}/api/garden?page=${page}&per_page=${perPage}${color ? `&color=${color}` : ""}`,
    );
    mockCreateOptimisticGardenRose.mockResolvedValue("temp-1");
    mockConfirmOptimisticGardenRose.mockResolvedValue(undefined);
    mockRejectOptimisticGardenRose.mockResolvedValue(undefined);
    mockCacheGardenPage.mockResolvedValue(null);
  });

  describe("auth storage", () => {
    it("returns and clears malformed stored user", () => {
      localStorage.setItem("user", "{bad json");
      expect(getUser()).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });

    it("stores user and sends logout request with refresh token", () => {
      setUser({ id: "u1", nickname: "alice", created_at: "2026-01-01T00:00:00Z" });
      setRefreshToken("refresh-token");
      (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

      expect(getUser()?.nickname).toBe("alice");
      logout();

      expect(localStorage.getItem("access_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/auth/logout",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer refresh-token",
          }),
        })
      );
    });
  });

  describe("refreshAccessToken", () => {
    it("returns null without refresh token", async () => {
      await expect(refreshAccessToken()).resolves.toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("stores a new access token after refresh", async () => {
      setRefreshToken("refresh-token");
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "new-access" }),
      });

      await expect(refreshAccessToken()).resolves.toBe("new-access");
      expect(localStorage.getItem("access_token")).toBe("new-access");
    });

    it("retries auth requests after a 401 refresh", async () => {
      setToken("old-access");
      setRefreshToken("refresh-token");
      const rose = { id: "r1", color: "red", is_private: false };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ status: 401, ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "new-access" }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => rose,
        });

      await expect(getRose("r1")).resolves.toEqual(rose);

      const roseCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([url]) => url === "http://localhost:3001/api/rose/r1",
      );
      const [, retryInit] = roseCalls.at(-1);
      expect(retryInit.headers).toEqual(expect.objectContaining({
        Authorization: "Bearer new-access",
      }));
    });

    it("clears auth state when refresh fails", async () => {
      setToken("old-access");
      setRefreshToken("refresh-token");
      setUser({ id: "u1", nickname: "alice", created_at: "2026-01-01T00:00:00Z" });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ status: 401, ok: false })
        .mockResolvedValueOnce({ ok: false });

      await expect(getRose("r1")).rejects.toThrow("Failed to fetch rose");
      expect(localStorage.getItem("access_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });
  });

  describe("createRose", () => {
    it("should create a rose with all fields", async () => {
      const mockRose = {
        id: "123",
        color: "red",
        gratitude: "感谢",
        anxiety: "焦虑",
        hope: "期待",
        user_id: null,
        created_at: "2026-05-27T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRose,
      });

      const result = await createRose({
        color: "red",
        gratitude: "感谢",
        anxiety: "焦虑",
        hope: "期待",
      });

      expect(result).toEqual(mockRose);
      expect(mockCreateOptimisticGardenRose).toHaveBeenCalledWith(
        JSON.stringify({
          color: "red",
          gratitude: "感谢",
          anxiety: "焦虑",
          hope: "期待",
          is_private: false,
        }),
        "",
      );
      expect(mockConfirmOptimisticGardenRose).toHaveBeenCalledWith("temp-1", mockRose);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/rose",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should include private flag in request body", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "1", color: "red", is_private: true }),
      });

      await createRose({ color: "red", gratitude: "secret", is_private: true });

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        color: "red",
        gratitude: "secret",
        anxiety: null,
        hope: null,
        is_private: true,
      });
    });

    it("should send auth header when token exists", async () => {
      setToken("test-token");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "1", color: "red", user_id: "u1", created_at: "" }),
      });

      await createRose({ color: "red", gratitude: "test" });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/rose",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should throw error on failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(createRose({ color: "red" })).rejects.toThrow("Failed to create rose");
      expect(mockRejectOptimisticGardenRose).toHaveBeenCalledWith("temp-1");
    });
  });

  describe("getGarden", () => {
    it("should return paginated roses", async () => {
      const mockResponse = {
        data: [
          { id: "1", color: "red", user_id: null, created_at: "2026-05-27T00:00:00Z" },
          { id: "2", color: "white", user_id: null, created_at: "2026-05-27T00:00:00Z" },
        ],
        total: 5,
        page: 1,
        per_page: 20,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getGarden();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/garden?page=1&per_page=20"
      );
      expect(mockCacheGardenPage).toHaveBeenCalledWith(mockResponse);
    });

    it("should accept page and perPage params", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], total: 0, page: 2, per_page: 10 }),
      });

      await getGarden(2, 10);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/garden?page=2&per_page=10"
      );
      expect(mockCacheGardenPage).not.toHaveBeenCalled();
    });

    it("should accept color filter without caching filtered results", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], total: 0, page: 1, per_page: 20 }),
      });

      await getGarden(1, 20, "red");
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/garden?page=1&per_page=20&color=red"
      );
      expect(mockCacheGardenPage).not.toHaveBeenCalled();
    });

    it("should throw error on failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(getGarden()).rejects.toThrow("Failed to fetch garden");
    });
  });

  describe("getRose", () => {
    it("should return a single rose", async () => {
      const mockRose = {
        id: "123",
        color: "yellow",
        user_id: "u1",
        created_at: "2026-05-27T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRose,
      });

      const result = await getRose("123");
      expect(result).toEqual(mockRose);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/rose/123",
        expect.objectContaining({
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
        })
      );
    });

    it("should throw error on failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(getRose("123")).rejects.toThrow("Failed to fetch rose");
    });
  });

  describe("updateRose", () => {
    it("should update a rose", async () => {
      setToken("test-token");
      const mockRose = {
        id: "123",
        color: "yellow",
        gratitude: "修改后",
        anxiety: null,
        hope: null,
        user_id: "u1",
        created_at: "2026-05-27T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRose,
      });

      const result = await updateRose("123", { color: "yellow", gratitude: "修改后" });

      expect(result).toEqual(mockRose);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/rose/123",
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should throw error on failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(updateRose("123", { color: "red" })).rejects.toThrow("Failed to update rose");
    });
  });

  describe("deleteRose", () => {
    it("should delete a rose", async () => {
      setToken("test-token");

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await deleteRose("123");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/rose/123",
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should throw error on failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(deleteRose("123")).rejects.toThrow("Failed to delete rose");
    });
  });

  describe("submitFeedback", () => {
    it("returns success when feedback is accepted", async () => {
      setToken("test-token");
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1 }),
      });

      await expect(submitFeedback("这个反馈很好")).resolves.toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/feedback",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("returns server error text when feedback is rejected", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => "too short",
      });

      await expect(submitFeedback("bad")).resolves.toEqual({
        success: false,
        error: "too short",
      });
    });

    it("returns thrown error message when feedback request fails", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("network down"));

      await expect(submitFeedback("网络失败")).resolves.toEqual({
        success: false,
        error: "network down",
      });
    });
  });
});

  describe("register", () => {
    it("should register a user", async () => {
      const mockResponse = {
        access_token: "jwt-access-token",
        refresh_token: "jwt-refresh-token",
        user: { id: "u1", nickname: "alice", created_at: "2026-05-27T00:00:00Z" },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await (await import("../api")).register("alice");
      expect(result).toEqual(mockResponse);
    });

    it("should throw error on failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect((await import("../api")).register("alice")).rejects.toThrow("Failed to register");
    });
  });

  describe("getHealth", () => {
    it("should return backend health", async () => {
      const mockResponse = { status: "ok", database: "healthy", version: "0.1.0" };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(getHealth()).resolves.toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith("http://localhost:3001/health");
    });

    it("should throw when health request fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(getHealth()).rejects.toThrow("Failed to fetch health");
    });
  });

  describe("getMyRoses", () => {
    it("should return paginated roses", async () => {
      const { setToken, getMyRoses } = await import("../api");
      setToken("test-token");

      const mockResponse = {
        data: [{ id: "1", color: "red", user_id: "u1", created_at: "" }],
        total: 1,
        page: 1,
        per_page: 20,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getMyRoses();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/my/roses?page=1&per_page=20",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
        })
      );
    });

    it("should throw error on failure", async () => {
      const { setToken, getMyRoses } = await import("../api");
      setToken("test-token");
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(getMyRoses()).rejects.toThrow("Failed to fetch my roses");
    });
  });

  describe("getUserProfile", () => {
    it("should return user profile", async () => {
      const { setToken, getUserProfile } = await import("../api");
      setToken("test-token");

      const mockProfile = {
        user: { id: "u1", nickname: "alice", created_at: "" },
        total_roses: 5,
        red_count: 2,
        white_count: 2,
        yellow_count: 1,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockProfile,
      });

      const result = await getUserProfile();
      expect(result).toEqual(mockProfile);
    });

    it("should refresh access token before retrying profile after 401", async () => {
      const { setToken, setRefreshToken, getUserProfile } = await import("../api");
      setToken("old-access");
      setRefreshToken("refresh-token");
      const mockProfile = {
        user: { id: "u1", nickname: "alice", created_at: "" },
        total_roses: 0,
        red_count: 0,
        white_count: 0,
        yellow_count: 0,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ status: 401, ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "new-access" }),
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => mockProfile,
        });

      await expect(getUserProfile()).resolves.toEqual(mockProfile);

      const profileCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([url]) => url === "http://localhost:3001/api/user/profile",
      );
      const [, retryInit] = profileCalls.at(-1);
      expect(retryInit.headers).toEqual(expect.objectContaining({
        Authorization: "Bearer new-access",
      }));
    });

    it("should clear stale auth when profile returns 401 without refresh token", async () => {
      const { setToken, setUser, getUserProfile } = await import("../api");
      setToken("stale-access");
      setUser({ id: "u1", nickname: "alice", created_at: "2026-01-01T00:00:00Z" });
      (global.fetch as jest.Mock).mockResolvedValue({ status: 401, ok: false });

      await expect(getUserProfile()).rejects.toThrow("Failed to fetch profile");

      expect(localStorage.getItem("access_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });

    it("should throw error on failure", async () => {
      const { setToken, getUserProfile } = await import("../api");
      setToken("test-token");
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(getUserProfile()).rejects.toThrow("Failed to fetch profile");
    });
  });

  describe("deactivateAccount", () => {
    it("should deactivate account and clear auth state", async () => {
      setToken("access-token");
      setRefreshToken("refresh-token");
      setUser({ id: "u1", nickname: "alice", created_at: "2026-01-01T00:00:00Z" });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          restore_deadline: "2026-07-23T00:00:00Z",
        }),
      });

      await expect(deactivateAccount("user_requested")).resolves.toEqual({
        success: true,
        restore_deadline: "2026-07-23T00:00:00Z",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/auth/deactivate",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer access-token",
          }),
          body: JSON.stringify({ reason: "user_requested" }),
        }),
      );
      expect(localStorage.getItem("access_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });

    it("should throw error when deactivation fails", async () => {
      setToken("access-token");
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(deactivateAccount()).rejects.toThrow("Failed to deactivate account");
    });
  });

  describe("toggleLike", () => {
    it("should toggle like", async () => {
      const { setToken, toggleLike } = await import("../api");
      setToken("test-token");

      const mockResponse = { liked: true, like_count: 1 };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await toggleLike("rose-1");
      expect(result).toEqual(mockResponse);
    });

    it("should throw error on failure", async () => {
      const { setToken, toggleLike } = await import("../api");
      setToken("test-token");
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(toggleLike("rose-1")).rejects.toThrow("Failed to toggle like");
    });
  });
