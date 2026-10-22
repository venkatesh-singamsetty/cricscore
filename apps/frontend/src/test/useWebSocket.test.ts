import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWebSocket } from "../hooks/useWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen();
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateRawMessage(rawData: string) {
    if (this.onmessage) {
      this.onmessage({ data: rawData });
    }
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }

  simulateError(err: any = new Error("WS error")) {
    if (this.onerror) this.onerror(err);
  }

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  });
}

describe("useWebSocket Hook", () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    // @ts-expect-error mock assignment
    global.WebSocket = MockWebSocket;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    global.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it("does not connect if URL is empty", () => {
    const { result } = renderHook(() => useWebSocket(""));
    expect(result.current.isConnected).toBe(false);
    expect(MockWebSocket.instances.length).toBe(0);
  });

  it("connects to the provided URL and updates isConnected on open", () => {
    const { result } = renderHook(() =>
      useWebSocket("wss://test.cricscore.com/ws"),
    );

    expect(MockWebSocket.instances.length).toBe(1);
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toBe("wss://test.cricscore.com/ws");
    expect(result.current.isConnected).toBe(false);

    act(() => {
      socket.simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("updates lastMessage with parsed payload and timestamp when message arrives", () => {
    const { result } = renderHook(() =>
      useWebSocket("wss://test.cricscore.com/ws"),
    );
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.simulateOpen();
    });

    const payload = {
      type: "LIVE_SCORE_UPDATE",
      matchId: "match-123",
      explicitTotalRuns: 42,
    };

    act(() => {
      socket.simulateMessage(payload);
    });

    expect(result.current.lastMessage).toMatchObject({
      type: "LIVE_SCORE_UPDATE",
      matchId: "match-123",
      explicitTotalRuns: 42,
    });
    expect((result.current.lastMessage as any)?._ts).toBeDefined();
  });

  it("handles malformed JSON without crashing", () => {
    const { result } = renderHook(() =>
      useWebSocket("wss://test.cricscore.com/ws"),
    );
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.simulateOpen();
      socket.simulateRawMessage("INVALID_JSON{{{");
    });

    expect(result.current.lastMessage).toBeNull();
  });

  it("attempts to reconnect after 3 seconds when disconnected", () => {
    const { result } = renderHook(() =>
      useWebSocket("wss://test.cricscore.com/ws"),
    );
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.simulateOpen();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      socket.simulateClose();
    });
    expect(result.current.isConnected).toBe(false);

    // Fast forward 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(MockWebSocket.instances.length).toBe(2);
  });

  it("closes socket and does not reconnect after unmount", () => {
    const { unmount } = renderHook(() =>
      useWebSocket("wss://test.cricscore.com/ws"),
    );
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.simulateOpen();
    });

    unmount();
    expect(socket.close).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should NOT have created a new connection
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("closes socket upon error", () => {
    renderHook(() => useWebSocket("wss://test.cricscore.com/ws"));
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.simulateOpen();
      socket.simulateError();
    });

    expect(socket.close).toHaveBeenCalled();
  });
});
