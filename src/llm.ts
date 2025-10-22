import type { AIMessage } from "../types";
import { generateFromMistral } from "./mistralClient";
import { systemPrompt } from "./systemPrompt";

export const runLLM = async ({
  messages,
  tools,
  temperature = 0.7,
  model = "open-mistral-nemo-2407",
}: {
  messages: AIMessage[];
  tools?: any[];
  temperature?: number;
  model?: string;
}) => {
  // Build the payload for Mistral
  const payload: any = {
    model,
    messages: [],
    temperature,
  };

  // ✅ Add system prompt as the first message
  payload.messages.push({
    role: "system",
    content: systemPrompt,
  });

  // Preprocess messages: remove empty assistant placeholders and dedupe
  const cleaned: any[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as any;
    if (msg.role === "assistant") {
      const hasToolCalls = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
      const hasContent = typeof msg.content === "string" && msg.content.trim() !== "";
      if (!hasToolCalls && !hasContent) continue; // skip empty assistant placeholders
    }

    if (msg.role === "user") {
      const last = cleaned[cleaned.length - 1];
      if (last && last.role === "user" && last.content === msg.content) continue; // skip duplicate user message
    }

    cleaned.push(msg);
  }

  // Transform cleaned messages into Mistral format
  for (const msg of cleaned) {
    if (msg.role === "user") {
      payload.messages.push({ role: "user", content: msg.content || "" });
    } else if (msg.role === "assistant") {
      const content = msg.content || "";
      const toolCalls = msg.tool_calls;
      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        payload.messages.push({ role: "assistant", content, tool_calls: toolCalls });
      } else if (content.trim() !== "") {
        payload.messages.push({ role: "assistant", content });
      }
    } else if (msg.role === "tool") {
      payload.messages.push({
        role: "tool",
        name: msg.name || "tool_response",
        content: msg.content || "",
        tool_call_id: msg.tool_call_id,
      });
    }
  }

  // Attach tools if needed
  const lastMsg = payload.messages[payload.messages.length - 1];
  const lastRole = lastMsg ? lastMsg.role : null;
  const shouldAttachTools = tools && tools.length > 0 && (lastRole === "user" || lastRole === "tool");

  console.log("LLM last role before attach:", lastRole);
  console.log("LLM attaching tools?", Boolean(shouldAttachTools));

  if (shouldAttachTools) {
    payload.tools = tools.map((t: any) => {
      if (t && t.type === "function" && t.function) return t;
      if (typeof t === "string")
        return { type: "function", function: { name: t, description: "", parameters: {} } };
      return {
        type: "function",
        function: {
          name: t.name,
          description: t.description || t.function?.description || "",
          parameters: t.parameters || t.function?.parameters || {},
        },
      };
    });
    payload.tool_choice = "auto";
    payload.parallel_tool_calls = false;
  }

  console.log(
    "LLM payload messages:",
    payload.messages.map((m: any, idx: number) => `${idx}:${m.role}:${(m.content || "").slice(0, 40)}`)
  );

  const rawOutput = await generateFromMistral(payload);
  let output: any = rawOutput;
  if (typeof rawOutput === "string") {
    try {
      output = JSON.parse(rawOutput);
    } catch {
      output = rawOutput;
    }
  }

  const message = output?.choices?.[0]?.message;
  return {
    role: "assistant",
    content: message?.content || "",
    tool_calls: message?.tool_calls || [],
  };
};
