export type Item = {
  id: string;
  object: string;                             // "realtime.item"
  type: "message" | "function_call" | "function_call_output";

  /* визуальные */
  timestamp?: string;
  status?: "running" | "completed";

  /* message */
  role?: "system" | "user" | "assistant" | "tool";
  content?: { type: string; text: string }[];

  /* function_call */
  name?: string;
  call_id?: string;
  params?: Record<string, any>;

  /* function_call_output */
  output?: string;

  /* метрики */
  latencyMs?: number;             
};

export interface PhoneNumber {
  sid: string;
  friendlyName: string;
  voiceUrl?: string;
}

export type FunctionCall = {
  name: string;
  params: Record<string, any>;
  completed?: boolean;
  response?: string;
  status?: string;
  call_id?: string;
};
