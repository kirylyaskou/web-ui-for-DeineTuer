import { Item } from "@/components/types";

export default function handleRealtimeEvent(
  ev: any,
  setItems: React.Dispatch<React.SetStateAction<Item[]>>
) {
  /* ───────── helpers ───────── */
  console.log(ev)
  const now = () => new Date().toLocaleTimeString();

  const createNewItem = (base: Partial<Item>): Item =>
  ({
    object: "realtime.item",
    timestamp: now(),
    ...base,
  } as Item);

  function updateOrAddItem(
    id: string,
    updates: Partial<Item> | ((prev?: Item) => Partial<Item>)
  ) {
    setItems((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      const prevItem = idx >= 0 ? prev[idx] : undefined;
      const patch =
        typeof updates === "function" ? updates(prevItem) : updates;

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...patch };
        return copy;
      }
      return [...prev, createNewItem({ id, ...patch })];
    });
  }

  switch (ev.type) {
    case "session.created":
      setItems([]);
      break;

    case "input_audio_buffer.speech_started": {
      const { item_id } = ev;
      updateOrAddItem(item_id, {
        type: "message",
        role: "user",
        content: [{ type: "text", text: "..." }],
        status: "running",
      });
      break;
    }

    case "conversation.item.input_audio_transcription.completed": {
      const { item_id, transcript } = ev;
      updateOrAddItem(item_id, {
        content: [{ type: "text", text: transcript }],
        status: "completed",
      });
      break;
    }
    case "latency.user_to_ai": {
      const { latency_ms } = ev;

      setItems((prev) => {
        const lastUserIdx = [...prev]
          .reverse()
          .findIndex((m) => m.role === "user" && m.type === "message");
        if (lastUserIdx < 0) return prev;

        const userIdx = prev.length - 1 - lastUserIdx;

        // Найти первое assistant-сообщение после userIdx
        const assistantIdx = prev.slice(userIdx + 1).findIndex(
          (m) => m.role === "assistant" && m.type === "message"
        );
        if (assistantIdx < 0) return prev;

        const realAssistantIdx = userIdx + 1 + assistantIdx;

        const copy = [...prev];
        copy[realAssistantIdx] = { ...copy[realAssistantIdx], latencyMs: latency_ms };
        return copy;
      });
      break;
    }


    case "conversation.item.created": {
      const { item } = ev;

      if (item.type === "message") {
        const content = item.content?.length ? item.content : [];
        updateOrAddItem(item.id, {
          ...item,
          content,
          status: "completed",
          timestamp: now(),
        });
      } else if (item.type === "function_call_output") {
        setItems((prev) => {
          const next = [
            ...prev,
            createNewItem({
              ...item,
              role: "tool",
              content: [{ type: "text", text: `Function response: ${item.output}` }],
              status: "completed",
            }),
          ];
          return next.map((m) =>
            m.call_id === item.call_id && m.type === "function_call"
              ? { ...m, status: "completed" }
              : m
          );
        });
      }
      break;
    }

    case "response.content_part.added": {
      const { item_id, part, output_index } = ev;
      if (part.type === "text" && output_index === 0) {
        updateOrAddItem(item_id, (prev) => {
          const old = prev?.content ?? [];
          return {
            type: "message",
            role: "assistant",
            status: "running",
            content: [...old, { type: part.type, text: part.text }],
          };
        });
      }
      break;
    }

    case "response.audio_transcript.delta": {
      const { item_id, delta, output_index } = ev;
      if (output_index === 0 && delta) {
        updateOrAddItem(item_id, (prev) => {
          const old = prev?.content ?? [];
          return {
            type: "message",
            role: "assistant",
            status: "running",
            content: [...old, { type: "text", text: delta }],
          };
        });
      }
      break;
    }

    case "response.output_item.done": {
      const { item } = ev;
      if (item.type === "function_call") {
        setItems((prev) => [
          ...prev,
          createNewItem({
            ...item,
            role: "assistant",
            content: [
              {
                type: "text",
                text: `${item.name}(${(() => {
                  try {
                    return JSON.stringify(JSON.parse(item.arguments));
                  } catch {
                    return item.arguments;
                  }
                })()})`,
              },
            ],
            status: "running",
          }),
        ]);
      }
      break;
    }

    case "response.audio.delta": {
      // Можно добавить отображение аудиодельт, если нужно
      break;
    }

    default:
      console.warn("Unknown event type:", ev.type, ev);
      break;
  }
}
