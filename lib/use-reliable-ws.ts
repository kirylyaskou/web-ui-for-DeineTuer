import { useRef, useEffect, useState, useCallback } from "react";

type MsgHandler = (payload: any) => void;

export default function useReliableWebSocket(
  url: string,
  onMessage: MsgHandler,
  protocols?: string | string[]
) {
  /* global singleton */
  const global = typeof window !== "undefined" ? (window as any).__logsWS : undefined;
  const wsRef  = useRef<WebSocket | null>(global ?? null);
  const retry  = useRef<NodeJS.Timeout>();
  const [readyState, setReady] = useState(
    wsRef.current?.readyState ?? WebSocket.CLOSED,
  );

  const connect = useCallback((attempt = 0) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log("[WS] try-connect", attempt);
    const ws = new WebSocket(url, protocols);
    wsRef.current = ws;
    setReady(WebSocket.CONNECTING);

    ws.onopen = () => {
      console.log("[WS] open");
      (window as any).__logsWS = ws;
      setReady(WebSocket.OPEN);

      const keep = setInterval(() => {
        ws.readyState === WebSocket.OPEN && ws.send("ping");
      }, 60_000);
      ws.addEventListener("close", () => clearInterval(keep));
    };

    ws.onmessage = (evt) => {
      if (evt.data === "pong") return;
      console.log("[WS] raw", typeof evt.data === "string"
        ? evt.data.slice(0, 120)
        : "<binary>");
      try {
        if (typeof evt.data === "string") {
          onMessage(JSON.parse(evt.data));
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    ws.onclose = (ev) => {
      console.log("[WS] close", ev.code, ev.reason);
      setReady(WebSocket.CLOSED);
      if (ev.code === 1001 && ev.reason === "duplicate client") return;
      const delay = Math.min(30_000, 2 ** attempt * 1_000);
      retry.current = setTimeout(() => connect(attempt + 1), delay);
    };

    ws.onerror = (e) => console.error("[WS] error", e);
  }, [url, onMessage, protocols]);

  useEffect(() => {
    connect();
    return () => {
      retry.current && clearTimeout(retry.current);
      /* глобальный сокет оставляем жить */
    };
  }, [connect]);

  return { ws: wsRef.current, readyState };
}
