import { useRef, useEffect, useState, useCallback } from "react";

type MsgHandler = (data: any) => void;

export default function useReliableWebSocket(
    url: string,
    onMessage: MsgHandler,
    protocols?: string | string[]
) {
    const wsRef = useRef<WebSocket | null>(null);
    const retryRef = useRef<NodeJS.Timeout>();
    const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);

    const connect = useCallback((attempt = 0) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

        try {
            const ws = new WebSocket(url, protocols);
            wsRef.current = ws;
            setReadyState(WebSocket.CONNECTING);

            ws.onopen = () => {
                setReadyState(WebSocket.OPEN);
                const pingId = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'), 60_000);
                ws.addEventListener("close", () => clearInterval(pingId));
            };

            ws.onmessage = (evt) => {
                console.log(evt)
                if (evt.data !== "pong") onMessage(JSON.parse(evt.data));
            };

            ws.onclose = () => {
                setReadyState(WebSocket.CLOSED);
                const delay = Math.min(30_000, 2 ** attempt * 1_000);
                retryRef.current = setTimeout(() => connect(attempt + 1), delay);
            };

            ws.onerror = () => ws.close();
        } catch (err) {
            console.error("WS connect error", err);
        }
    }, [url, onMessage, protocols]);

    useEffect(() => {
        connect();
        return () => {
            retryRef.current && clearTimeout(retryRef.current);
            wsRef.current?.close();
        };
    }, [connect]);

    return { ws: wsRef.current, readyState };
}
