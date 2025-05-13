import { useEffect, useRef, useState } from "react";
import { getWebSocket, subscribe } from "./singletonWebSocket";

export default function useReliableWebSocket(
    url: string,
    onMessage: (payload: any) => void,
    protocols?: string | string[]
) {
    const [readyState, setReady] = useState<WebSocket["readyState"]>(WebSocket.CLOSED);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const ws = getWebSocket(url, protocols);
        wsRef.current = ws;

        const handleOpen = () => setReady(WebSocket.OPEN);
        const handleClose = () => setReady(WebSocket.CLOSED);

        ws.addEventListener("open", handleOpen);
        ws.addEventListener("close", handleClose);

        // Подписка на сообщения
        const unsub = subscribe(onMessage);

        // ping-keepalive
        const keep = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 60_000);

        return () => {
            ws.removeEventListener("open", handleOpen);
            ws.removeEventListener("close", handleClose);
            clearInterval(keep);
            unsub();
        };
    }, [url, protocols, onMessage]);

    return { ws: wsRef.current, readyState };
}