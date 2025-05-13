let ws: WebSocket | null = null;
let listeners: ((data: any) => void)[] = [];

export function getWebSocket(url: string, protocols?: string | string[]) {
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    ws = new WebSocket(url, protocols);
    ws.onmessage = (evt) => {
      if (evt.data === "pong") return;
      try {
        const data = JSON.parse(evt.data);
        listeners.forEach((cb) => cb(data));
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };
    ws.onclose = () => {
      ws = null;
      listeners = [];
    };
  }
  return ws;
}

export function subscribe(cb: (data: any) => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
