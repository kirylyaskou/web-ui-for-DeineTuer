import React, { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Phone, MessageSquare, Wrench, Clock } from "lucide-react";
import { Item } from "@/components/types";

type TranscriptProps = { items: Item[] };

const Transcript: React.FC<TranscriptProps> = ({ items }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  const shown = items.filter((it) =>
    ["message", "function_call", "function_call_output"].includes(it.type)
  );

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardContent className="flex-1 h-full min-h-0 overflow-hidden flex flex-col p-0">
        {shown.length === 0 && (
          <div className="flex flex-1 h-full items-center justify-center mt-36">
            <div className="flex flex-col items-center gap-3">
              <div className="h-[140px] w-[140px] rounded-full bg-secondary/20 flex items-center justify-center">
                <MessageSquare className="h-16 w-16 text-foreground/10" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground/60">No messages yet</p>
                <p className="text-sm text-muted-foreground">Start a call to see the transcript</p>
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="h-full">
          <div className="flex flex-col gap-6 p-6">
            {shown.map((msg, i) => {
              const isUser = msg.role === "user";
              const isTool = msg.role === "tool";
              const Icon = isUser ? Phone : isTool ? Wrench : Bot;
              const text = msg.content?.map((c) => c.text).join("") ?? "";

              return (
                <div key={i} className="flex items-start gap-3">
                  {/* аватар */}
                  <div
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${isUser
                        ? "bg-background border-border"
                        : "bg-secondary border-secondary"
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* текст + метаданные */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`text-sm font-medium ${isUser ? "text-muted-foreground" : "text-foreground"
                          }`}
                      >
                        {isUser ? "Caller" : isTool ? "Tool Response" : "Assistant"}
                      </span>

                      <span className="text-xs text-muted-foreground">{msg.timestamp}</span>

                      {!isUser && msg.role === "assistant" && msg.latencyMs !== undefined && (
                        <span className="flex items-center gap-1 text-xs text-orange-600">
                          <Clock className="h-3 w-3" />
                          {msg.latencyMs} ms
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed break-words">
                      {text}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default Transcript;
