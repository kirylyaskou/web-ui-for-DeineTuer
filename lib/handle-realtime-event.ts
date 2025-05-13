/* src/utils/handleRealtimeEvent.ts ------------------------------------------------- */
import { Item } from "@/components/types";

/* Буфер, куда по item_id постепенно собираются JSON-аргументы функции */
const argBuffers: Record<string, string> = {};

export default function handleRealtimeEvent(
  ev: any,
  setItems: React.Dispatch<React.SetStateAction<Item[]>>
) {
  /* ───────── helpers ───────── */
  console.log(ev);
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

  /* ───────── основной switch ───────── */
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

    case "conversation.item.input_audio_transcription.delta": {
      /* Просто игнорируем, чтобы не спамить warning-ами */
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

    /* ---------- Бэкенд создал item ---------- */
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

    /* ---------- Function-call: дельты аргументов ---------- */
    case "response.function_call_arguments.delta": {
      const { item_id, delta } = ev;
      argBuffers[item_id] = (argBuffers[item_id] ?? "") + delta;

      updateOrAddItem(item_id, {
        type: "function_call",
        role: "assistant",
        status: "running",
        content: [{ type: "text", text: argBuffers[item_id] }],
      });
      break;
    }

    case "response.function_call_arguments.done": {
      const { item_id, name, arguments: argsJson } = ev;
      argBuffers[item_id] = argBuffers[item_id] ?? argsJson;

      updateOrAddItem(item_id, {
        type: "function_call",
        role: "assistant",
        status: "completed",
        name,
        content: [{ type: "text", text: argBuffers[item_id] }],
      });
      delete argBuffers[item_id];
      break;
    }

    /* ---------- Вызов функции завершён ---------- */
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
                text: `${item.name}(${item.arguments})`,
              },
            ],
            status: "running",
          }),
        ]);
      }
      break;
    }

    /* ---------- Streaming text ---------- */
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

    /* ---------- Streaming transcript ---------- */
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

    /* ---------- Аудио-дельты (можно игнорировать) ---------- */
    case "response.audio.delta":
      break;

    /* ---------- Прочие системные события: молча игнорируем ---------- */
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
