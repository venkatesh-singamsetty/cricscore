import { useState, useEffect, useCallback, useRef } from "react";

export interface WebSocketMessage {
  type: string;
  data: any;
}

export const useWebSocket = (url: string) => {
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const shouldReconnect = useRef(true);

  const connect = useCallback(() => {
    if (!url) return;
    if (
      ws.current?.readyState === WebSocket.OPEN ||
      ws.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    // lgtm[js/client-side-unvalidated-url-redirection]
    console.log("Connecting to WebSocket:", String(url).replace(/\n|\r/g, ""));
    const socket = new WebSocket(url);

    socket.onopen = () => {
      console.log("WebSocket Connected ✅");
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // lgtm[js/client-side-unvalidated-url-redirection]
        console.log(
          "WebSocket Message Received 📥",
          JSON.stringify(data).replace(/\n|\r/g, ""),
        );
        // lgtm[js/remote-property-injection]
        setLastMessage({ ...data, _ts: Date.now() });
      } catch (err) {
        console.error("Failed to parse WebSocket message");
      }
    };

    socket.onclose = () => {
      console.log("WebSocket Disconnected ❌");
      setIsConnected(false);
      ws.current = null;
      if (!shouldReconnect.current) return;
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    socket.onerror = (err) => {
      console.error("WebSocket Error");
      socket.close();
    };

    ws.current = socket;
  }, [url]);

  useEffect(() => {
    shouldReconnect.current = true;
    connect();
    return () => {
      shouldReconnect.current = false;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [connect]);

  return { lastMessage, isConnected };
};
