import { createRose, getGarden, getRose } from "../api";

// Mock fetch globally
global.fetch = jest.fn();

describe("API Client", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("createRose", () => {
    it("should create a rose with all fields", async () => {
      const mockRose = {
        id: "123",
        color: "red",
        gratitude: "感谢",
        anxiety: "焦虑",
        hope: "期待",
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
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("should throw error on failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      await expect(createRose({ color: "red" })).rejects.toThrow(
        "Failed to create rose"
      );
    });
  });

  describe("getGarden", () => {
    it("should return paginated roses", async () => {
      const mockResponse = {
        data: [
          { id: "1", color: "red", created_at: "2026-05-27T00:00:00Z" },
          { id: "2", color: "white", created_at: "2026-05-27T00:00:00Z" },
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
      const mockResponse = { data: [], total: 0, page: 2, per_page: 10 };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await getGarden(2, 10);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/garden?page=2&per_page=10"
      );
    });

    it("should throw error on failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      await expect(getGarden()).rejects.toThrow("Failed to fetch garden");
    });
  });

  describe("getRose", () => {
    it("should return a single rose", async () => {
      const mockRose = {
        id: "123",
        color: "yellow",
        created_at: "2026-05-27T00:00:00Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRose,
      });

      const result = await getRose("123");

      expect(result).toEqual(mockRose);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/rose/123"
      );
    });

    it("should throw error on failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      await expect(getRose("123")).rejects.toThrow("Failed to fetch rose");
    });
  });
});
