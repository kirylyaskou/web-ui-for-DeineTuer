"use client";

import React, { useCallback, useState } from "react";
import TopBar from "@/components/top-bar";
import ChecklistAndConfig from "@/components/checklist-and-config";
import SessionConfigurationPanel from "@/components/session-configuration-panel";
import Transcript from "@/components/transcript";
import FunctionCallsPanel from "@/components/function-calls-panel";
import PhoneNumberChecklist from "@/components/phone-number-checklist";
import handleRealtimeEvent from "@/lib/handle-realtime-event";
import { Item } from "@/components/types";
import useReliableWebSocket from "@/lib/use-reliable-ws";

const WS_URL = "wss://deinetuerai-production.up.railway.app/logs";

export default function CallInterface() {
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState("");
  const [allConfigsReady, setAllConfigsReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  const onWsMessage = useCallback(
    (data: any) => handleRealtimeEvent(data, setItems),
    []
  );
  const { ws, readyState } = useReliableWebSocket(WS_URL, onWsMessage);

  const sendIfOpen = useCallback(
    (obj: unknown) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
    },
    [ws]
  );
  const callStatus =
    readyState === WebSocket.OPEN
      ? "connected"
      : readyState === WebSocket.CONNECTING
        ? "connecting"
        : "disconnected";

  return (
    <div className="h-screen bg-white flex flex-col">
      <ChecklistAndConfig
        ready={allConfigsReady}
        setReady={setAllConfigsReady}
        selectedPhoneNumber={selectedPhoneNumber}
        setSelectedPhoneNumber={setSelectedPhoneNumber}
      />

      <TopBar />

      <div className="flex-grow p-4 h-full overflow-hidden flex flex-col">
        <div className="grid grid-cols-12 gap-4 h-full">

          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            <SessionConfigurationPanel
              callStatus={callStatus}
              onSave={(config) =>
                sendIfOpen({ type: "session.update", session: config })
              }
            />
          </div>

          <div className="col-span-6 flex flex-col gap-4 h-full overflow-hidden">
            <PhoneNumberChecklist
              selectedPhoneNumber={selectedPhoneNumber}
              allConfigsReady={allConfigsReady}
              setAllConfigsReady={setAllConfigsReady}
            />
            <Transcript items={items} />
          </div>

          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            <FunctionCallsPanel items={items} ws={ws ?? undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}
