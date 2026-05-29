import { connectGardenWs } from "../ws";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  close = jest.fn();

  constructor() {
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
