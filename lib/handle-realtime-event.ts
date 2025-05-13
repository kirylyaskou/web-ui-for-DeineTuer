/* src/utils/handleRealtimeEvent.ts --------------------------------- */
import { Item } from "@/components/types";

/* Буфер для поступающих частями аргументов */
const argBuffers: Record<string, string> = {};

export default function handleRealtimeEvent(
  ev: any,
  setItems: React.Dispatch<React.SetStateAction<Item[]>>
) {
  /* helpers -------------------------------------------------------- */
  const now = () => new Date().toLocaleTimeString();
  const createNewItem = (base: Partial<Item>): Item =>
    ({ object: "realtime.item", timestamp: now(), ...base } as Item);

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

  /* main switch ---------------------------------------------------- */
  switch (ev.type) {
    /* ---------- Session ---------- */
    case "session.created":
      setItems([]);
      break;

    /* ---------- User speech ---------- */
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

    /* ---------- Latency ---------- */
    case "latency.user_to_ai": {
      const { latency_ms } = ev;
      setItems((prev) => {
        const lastUserIdx = [...prev]
          .reverse()
          .findIndex((m) => m.role === "user" && m.type === "message");
        if (lastUserIdx < 0) return prev;
        const userIdx = prev.length - 1 - lastUserIdx;

        const assistantIdx = prev
          .slice(userIdx + 1)
          .findIndex((m) => m.role === "assistant" && m.type === "message");
        if (assistantIdx < 0) return prev;

        const realAssistantIdx = userIdx + 1 + assistantIdx;
        const copy = [...prev];
        copy[realAssistantIdx] = {
          ...copy[realAssistantIdx],
          latencyMs: latency_ms,
        };
        return copy;
      });
      break;
    }

    /* ---------- Backend created item ---------- */
    case "conversation.item.created": {
      const { item } = ev;
      if (item.type === "message") {
        updateOrAddItem(item.id, {
          ...item,
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
              content: [
                { type: "text", text: `Function response: ${item.output}` },
              ],
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

    /* ---------- Function-call arguments (streaming) -------- */
    case "response.function_call_arguments.delta": {
      const { item_id, delta } = ev;
      argBuffers[item_id] = (argBuffers[item_id] ?? "") + delta;

      updateOrAddItem(item_id, {
        type: "function_call",
        role: "assistant",
        status: "running",
        /* НЕ добавляем поле arguments – пока JSON не валиден */
        content: [{ type: "text", text: argBuffers[item_id] }],
      });
      break;
    }

    case "response.function_call_arguments.done": {
      const { item_id, name, arguments: argsJson } = ev;
      /* сохраняем финальный валидный JSON-строку */
      argBuffers[item_id] = argsJson;

      updateOrAddItem(item_id, {
        type: "function_call",
        role: "assistant",
        status: "completed",
        name,
        arguments: argsJson,                      // валидно
        content: [{ type: "text", text: argsJson }],
      });
      delete argBuffers[item_id];
      break;
    }

    /* ---------- Функция полностью сформирована ---------- */
    case "response.output_item.done": {
      const { item } = ev;
      if (item.type === "function_call") {
        setItems((prev) => [
          ...prev,
          createNewItem({
            id: item.id,
            type: "function_call",
            role: "assistant",
            status: "running",
            name: item.name,
            arguments: item.arguments,            // валидная строка
            content: [
              {
                type: "text",
                text: `${item.name}(${item.arguments})`,
              },
            ],
          }),
        ]);
      }
      break;
    }

    /* ---------- Streaming text ---------- */
    case "response.content_part.added": {
      const { item_id, part, output_index } = ev;
      if (part.type === "text" && output_index === 0) {
        updateOrAddItem(item_id, (prev) => ({
          ...prev,
          type: "message",
          role: "assistant",
          status: "running",
          content: [...(prev?.content ?? []), { type: "text", text: part.text }],
        }));
      }
      break;
    }

    /* ---------- Streaming transcript ---------- */
    case "response.audio_transcript.delta": {
      const { item_id, delta, output_index } = ev;
      if (output_index === 0 && delta) {
        updateOrAddItem(item_id, (prev) => ({
          ...prev,
          type: "message",
          role: "assistant",
          status: "running",
          content: [...(prev?.content ?? []), { type: "text", text: delta }],
        }));
      }
      break;
    }

    /* ---------- Audio deltas (ignored) ---------- */
    case "response.audio.delta":
      break;

    /* ---------- System noise we ignore ---------- */
    case "session.updated":
    case "response.created":
    case "response.done":
    case "response.audio.done":
    case "response.audio_transcript.done":
    case "response.content_part.done":
    case "response.output_item.added":
    case "response.audio.silence":
    case "input_audio_buffer.speech_stopped":
    case "input_audio_buffer.committed":
    case "conversation.item.truncated":
    case "rate_limits.updated":
      break;

    /* ---------- Unknown ---------- */
    default:
      console.warn("Unknown event type:", ev.type, ev);
      break;
  }
}
