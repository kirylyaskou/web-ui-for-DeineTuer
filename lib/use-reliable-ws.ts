import { useRef, useEffect, useState, useCallback } from "react";

type MsgHandler = (payload: any) => void;

export default function useReliableWebSocket(
  url: string,
  onMessage: MsgHandler,
  protocols?: string | string[]
) {
  /***************** refs & state *****************/
  const wsRef   = useRef<WebSocket | null>(
    typeof window !== "undefined" ? (window as any).__logsWS ?? null : null
  );
  const retryId = useRef<NodeJS.Timeout>();
  const [readyState, setReadyState] = useState<number>(
    wsRef.current?.readyState ?? WebSocket.CLOSED
  );

  /***************** helpers *****************/
  const connect = useCallback((attempt = 0) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return; // уже открыт

    console.log("WS try-connect", url, "attempt", attempt);
    const ws = new WebSocket(url, protocols);
    wsRef.current = ws;
    (window as any).__logsWS = ws;                // глобальный singleton
    setReadyState(WebSocket.CONNECTING);

    /* --- lifecycle --- */
    ws.onopen = () => {
      console.log("WS open", url);
      setReadyState(WebSocket.OPEN);

      /* keep-alive ping */
      const keep = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}');
      }, 60_000);
      ws.addEventListener("close", () => clearInterval(keep));
    };

    ws.onmessage = (evt) => {
      if (evt.data === "pong") return;
      console.log("WS msg", typeof evt.data === "string"
        ? evt.data.slice(0, 200)
        : "<binary>"
      );
      try { onMessage(JSON.parse(evt.data as string)); }
      catch (err) { console.error("WS parse error:", err); }
    };

    ws.onclose = (ev) => {
      console.log("WS close", ev.code, ev.reason);
      setReadyState(WebSocket.CLOSED);

      /* код 1001 duplicate → новый сокет не нужен */
      if (ev.code === 1001 && ev.reason === "duplicate client") return;

      const delay = Math.min(30_000, 2 ** attempt * 1_000);
      retryId.current = setTimeout(() => connect(attempt + 1), delay);
    };

    ws.onerror = (err) => console.error("WS error", err);
  }, [url, onMessage, protocols]);

  /***************** mount / unmount *****************/
  useEffect(() => {
    connect();                // первый запуск
    return () => {
      retryId.current && clearTimeout(retryId.current);
      /* не закрываем wsRef.current, чтобы жить на всей вкладке */
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);                     // URL не меняется → пустой deps-array

  return { ws: wsRef.current, readyState };
}
