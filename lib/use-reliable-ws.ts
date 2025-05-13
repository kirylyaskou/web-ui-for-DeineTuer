import { useRef, useEffect, useState, useCallback } from "react";

type MsgHandler = (d: any) => void;

export default function useReliableWebSocket(
  url: string,
  onMessage: MsgHandler,
  protocols?: string | string[]
) {
  const wsRef   = useRef<WebSocket | null>(null);
  const retryId = useRef<NodeJS.Timeout>();
  const [ready, setReady] = useState<number>(WebSocket.CLOSED);

  /* -------- connect ---------- */
  const connect = useCallback((attempt = 0) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(url, protocols);
    wsRef.current = ws;
    setReady(WebSocket.CONNECTING);

    ws.onopen = () => {
      console.log("WS open", url);
      setReady(WebSocket.OPEN);
      const id = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'), 60_000);
      ws.addEventListener("close", () => clearInterval(id));
    };

    ws.onmessage = (e) => {
      console.log("WS ▶ message", typeof e.data === "string" ? e.data.slice(0, 200) : "<binary>");
      if (e.data !== "pong") {
        try { onMessage(JSON.parse(e.data as string)); }
        catch (err) { console.error("WS JSON parse error", err); }
      }
    };

    ws.onclose = (evt) => {
      console.log("WS close", evt.code, evt.reason);
      setReady(WebSocket.CLOSED);
      const backoff = Math.min(30_000, 2 ** attempt * 1_000);
      retryId.current = setTimeout(() => connect(attempt + 1), backoff);
    };

    ws.onerror = (err) => { console.error("WS error", err); ws.close(); };
  }, [url, onMessage, protocols]);

  useEffect(() => { connect(); return () => { retryId.current && clearTimeout(retryId.current); wsRef.current?.close(); }; }, [connect]);

  return { ws: wsRef.current, readyState: ready };
}
