import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item } from "@/components/types";

type FunctionCallsPanelProps = {
  items: Item[];
  ws?: WebSocket | null;
};

/* ――― безопасный stringify ─―― */
function pretty(raw?: string) {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw; // вернём как есть, если JSON ещё не закончен
  }
}

const FunctionCallsPanel: React.FC<FunctionCallsPanelProps> = ({
  items,
  ws,
}) => {
  const [responses, setResponses] = useState<Record<string, string>>({});

  /* только function_call items */
  const functionCalls = items.filter((it) => it.type === "function_call");

  /* добавляем статус и найденный output */
  const functionCallsWithStatus = functionCalls.map((call) => {
    const outputItem = items.find(
      (it) =>
        it.type === "function_call_output" && it.call_id === call.call_id
    );
    return {
      ...call,
      completed: call.status === "completed" || !!outputItem,
      response: outputItem?.output,
    };
  });

  const handleChange = (call_id: string, value: string) =>
    setResponses((prev) => ({ ...prev, [call_id]: value }));

  const handleSubmit = (call: Item) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const call_id = call.call_id ?? "";
    ws.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id,
          output: JSON.stringify(responses[call_id] ?? ""),
        },
      })
    );
    ws.send(JSON.stringify({ type: "response.create" }));
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="space-y-1.5 pb-0">
        <CardTitle className="text-base font-semibold">
          Function Calls
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-4">
        <ScrollArea className="h-full">
          <div className="space-y-4">
            {functionCallsWithStatus.map((call) => (
              <div
                key={call.id}
                className="rounded-lg border bg-card p-4 space-y-3"
              >
                {/* header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{call.name}</h3>
                  <Badge variant={call.completed ? "default" : "secondary"}>
                    {call.completed ? "Completed" : "Pending"}
                  </Badge>
                </div>

                {/* аргументы */}
                <div className="text-sm text-muted-foreground font-mono break-all">
                  {pretty((call as any).arguments)}
                </div>

                {/* ввод ответа или уже готовый ответ */}
                {!call.completed ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Enter response"
                      value={responses[call.call_id ?? ""] ?? ""}
                      onChange={(e) =>
                        handleChange(call.call_id ?? "", e.target.value)
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSubmit(call)}
                      disabled={!responses[call.call_id ?? ""]}
                      className="w-full"
                    >
                      Submit Response
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm rounded-md bg-muted p-3 font-mono">
                    {pretty(call.response)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default FunctionCallsPanel;
