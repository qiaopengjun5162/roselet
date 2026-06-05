import { createRose, getGarden, getRose, updateRose, deleteRose, setToken, logout } from "../api";

global.fetch = jest.fn();

describe("API Client", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    logout();
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
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/rose",
        expect.objectContaining({ method: "POST" })
      );
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
      expect(global.fetch).toHaveBeenCalledWith("http://localhost:3001/api/rose/123");
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

    it("should throw error on failure", async () => {
      const { setToken, getUserProfile } = await import("../api");
      setToken("test-token");
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(getUserProfile()).rejects.toThrow("Failed to fetch profile");
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
