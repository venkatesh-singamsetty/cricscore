import { useState, useEffect, useCallback, useRef } from 'react';

export interface WebSocketMessage {
    type: string;
    data: any;
}

export const useWebSocket = (url: string) => {
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout>();

    const connect = useCallback(() => {
        if (ws.current?.readyState === WebSocket.OPEN) return;

        console.log("Connecting to WebSocket:", url);
        const socket = new WebSocket(url);

        socket.onopen = () => {
            console.log("WebSocket Connected ✅");
            setIsConnected(true);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("WebSocket Message Received 📥:", data);
                setLastMessage(data);
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        };

        socket.onclose = () => {
            console.log("WebSocket Disconnected ❌");
            setIsConnected(false);
            // Auto-reconnect after 3 seconds
            reconnectTimeout.current = setTimeout(connect, 3000);
        };

        socket.onerror = (err) => {
            console.error("WebSocket Error:", err);
            socket.close();
        };

        ws.current = socket;
    }, [url]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            if (ws.current) ws.current.close();
        };
    }, [connect]);

    return { lastMessage, isConnected };
};
