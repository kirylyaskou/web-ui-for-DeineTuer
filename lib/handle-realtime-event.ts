import { useRef, useEffect, useState, useCallback } from "react";

type MsgHandler = (payload: any) => void;

export default function useReliableWebSocket(
  url: string,
  onMessage: MsgHandler,
  protocols?: string | string[]
) {
  /* ───────── singleton ───────── */
  const globalWS =
    typeof window !== "undefined" ? (window as any).__logsWS : undefined;

  const wsRef   = useRef<WebSocket | null>(globalWS ?? null);
  const retryId = useRef<NodeJS.Timeout>();
  const [readyState, setReadyState] = useState<number>(
    wsRef.current?.readyState ?? WebSocket.CLOSED
  );

  /* ───────── connect logic ───── */
  const connect = useCallback((attempt = 0) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log("WS try-connect", url, "attempt", attempt);
    const ws = new WebSocket(url, protocols);
    wsRef.current = ws;
    setReadyState(WebSocket.CONNECTING);

    /* ----- open ----- */
    ws.onopen = () => {
      console.log("WS open", url);
      (window as any).__logsWS = ws;         // запоминаем глобально
      setReadyState(WebSocket.OPEN);

      /* keep-alive ping */
      const id = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 60_000);
      ws.addEventListener("close", () => clearInterval(id));
    };

    /* ----- message ----- */
    ws.onmessage = (evt) => {
      if (evt.data === "pong") return;       // ответ на ping
      console.log("WS msg", typeof evt.data === "string"
        ? evt.data.slice(0, 150)
        : "<binary>"
      );
      try   { onMessage(JSON.parse(evt.data as string)); }
      catch { console.error("WS parse error"); }
    };

    /* ----- close ----- */
    ws.onclose = (ev) => {
      console.log("WS close", ev.code, ev.reason);
      setReadyState(WebSocket.CLOSED);

      /* duplicate → оставляем старый живым, без reconnect */
      if (ev.code === 1001 && ev.reason === "duplicate client") return;

      const delay = Math.min(30_000, 2 ** attempt * 1_000);
      retryId.current = setTimeout(() => connect(attempt + 1), delay);
    };

    ws.onerror = (e) => console.error("WS error", e);
  }, [url, onMessage, protocols]);

  /* ───────── mount/unmount ───── */
  useEffect(() => {
    connect();                                // первый запуск
    return () => {
      retryId.current && clearTimeout(retryId.current);
      /* сокет глобальный – не закрываем здесь */
    };
  }, [connect]);

  return { ws: wsRef.current, readyState };
}
