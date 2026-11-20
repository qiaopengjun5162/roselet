import { connectGardenWs } from "../ws";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  close = jest.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }
}

const OriginalWebSocket = global.WebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
  global.WebSocket = OriginalWebSocket;
});

describe("connectGardenWs", () => {
  it("should create WebSocket connection", () => {
    const disconnect = connectGardenWs(() => {});
    expect(MockWebSocket.instances).toHaveLength(1);
    disconnect();
  });

  it("should derive secure websocket url from api origin when env is missing", async () => {
    const oldWsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const oldApiUrl = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_WS_URL;
    process.env.NEXT_PUBLIC_API_URL = "https://roselet.example.com";

    jest.resetModules();
    const { connectGardenWs: isolatedConnectGardenWs } = await import("../ws");
    isolatedConnectGardenWs(() => {});

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe(
      "wss://roselet.example.com/api/ws",
    );

    process.env.NEXT_PUBLIC_WS_URL = oldWsUrl;
    process.env.NEXT_PUBLIC_API_URL = oldApiUrl;
  });

  it("should follow the page origin when the build is same-origin", async () => {
    const oldWsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const oldApiUrl = process.env.NEXT_PUBLIC_API_URL;
    const oldReadUrl = process.env.NEXT_PUBLIC_READ_API_URL;
    delete process.env.NEXT_PUBLIC_WS_URL;
    delete process.env.NEXT_PUBLIC_READ_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "same-origin";

    jest.resetModules();
    const { connectGardenWs: isolatedConnectGardenWs } = await import("../ws");
    isolatedConnectGardenWs(() => {});

    // 同源时不能落到 localhost:3001（那是 dev 兜底），要跟着页面自己的 host 走。
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe(`ws://${window.location.host}/api/ws`);

    process.env.NEXT_PUBLIC_WS_URL = oldWsUrl;
    process.env.NEXT_PUBLIC_API_URL = oldApiUrl;
    process.env.NEXT_PUBLIC_READ_API_URL = oldReadUrl;
  });

  it("should call onRose when message received", () => {
    const handler = jest.fn();
    connectGardenWs(handler);

    const ws = MockWebSocket.instances[0];
    const rose = { id: "1", color: "red", gratitude: "test" };
    ws.simulateMessage(rose);

    expect(handler).toHaveBeenCalledWith(rose);
  });

  it("should close WebSocket on disconnect", () => {
    const disconnect = connectGardenWs(() => {});
    const ws = MockWebSocket.instances[0];

    disconnect();
    expect(ws.close).toHaveBeenCalled();
  });

  it("should close WebSocket on error", () => {
    connectGardenWs(() => {});
    const ws = MockWebSocket.instances[0];

    ws.simulateError();
    expect(ws.close).toHaveBeenCalled();
  });

  it("should handle malformed JSON gracefully", () => {
    const handler = jest.fn();
    connectGardenWs(handler);

    const ws = MockWebSocket.instances[0];
    ws.onmessage?.({ data: "not json" });

    expect(handler).not.toHaveBeenCalled();
  });
});
