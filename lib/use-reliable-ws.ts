import { useRef, useEffect, useState, useCallback } from "react";

type MsgHandler = (data: any) => void;

export default function useReliableWebSocket(
    url: string,
    onMessage: MsgHandler,
    protocols?: string | string[]
) {
    const wsRef = useRef<WebSocket | null>(null);
    const retryId = useRef<NodeJS.Timeout>();
    const [ready, setReady] = useState<number>(WebSocket.CLOSED);
    const mounted = useRef(false);

    const connect = useCallback((attempt = 0) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        console.log("WS try-connect", url, "attempt", attempt);
        const ws = new WebSocket(url, protocols);
        wsRef.current = ws;
        setReady(WebSocket.CONNECTING);

        ws.onopen = () => {
            console.log("WS open", url);
            setReady(WebSocket.OPEN);
            const keep = setInterval(
                () => ws.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'),
                60_000
            );
            ws.addEventListener("close", () => clearInterval(keep));
        };

        ws.onmessage = (evt) => {
            console.log("WS msg", (typeof evt.data === "string" ? evt.data.slice(0, 120) : "<binary>"));
            if (evt.data !== "pong") {
                try { onMessage(JSON.parse(evt.data as string)); }
                catch (e) { console.error("WS JSON parse err", e); }
            }
        };

        ws.onclose = (ev) => {
            console.log("WS close", ev.code, ev.reason);
            setReady(WebSocket.CLOSED);
            const delay = Math.min(30_000, 2 ** attempt * 1_000);
            retryId.current = setTimeout(() => connect(attempt + 1), delay);
        };

        /* просто логируем ошибку, НЕ закрываем сокет вручную */
        ws.onerror = (e) => console.error("WS error", e);
    }, [url, onMessage, protocols]);

    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;

        connect();
        return () => {
            retryId.current && clearTimeout(retryId.current);
            wsRef.current?.close(1000, "unload");
        };
    }, [connect]);

    return { ws: wsRef.current, readyState: ready };
}
