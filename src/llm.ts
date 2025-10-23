import type { AIMessage } from "../types";
import { generateFromMistral } from "./mistralClient";
import { systemPrompt } from "./systemPrompt";
import { getSummary } from "./memory";


// Define a default system prompt
const defaultSystemPrompt = "This is the default system prompt.";

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
  systemPrompt?: string;
}) => {
  const summary = await getSummary()
  // Build the payload for Mistral
  const payload: any = {
    model,
    messages: [],
    temperature,
  };

  // ✅ Add system prompt as the first message
  payload.messages.push({
    role: "system",
    content: `${systemPrompt || defaultSystemPrompt}. Conversation so far: ${summary}`,
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

  // console.log("LLM last role before attach:", lastRole);
  // console.log("LLM attaching tools?", Boolean(shouldAttachTools));

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

  // console.log(
  //   "LLM payload messages:",
  //   payload.messages.map((m: any, idx: number) => `${idx}:${m.role}:${(m.content || "").slice(0, 40)}`)
  // );

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




export const runApprovalCheck = async (userMessage: string) => {
  const model = 'open-mistral-nemo-2407'

  // Ask the model to return a strict JSON document with only {"approved": true|false}
  const payload: any = {
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a validation assistant. Respond with a single JSON object and nothing else. The object must have the boolean field `approved`. If you are unsure, set approved to false.',
      },
      { role: 'user', content: `User said: "${userMessage.replace(/"/g, '\\"')}". Did the user explicitly approve the image generation? Respond with JSON only.` },
    ],
    temperature: 0.1,
  }

  const raw = await generateFromMistral(payload)
  let text = typeof raw === 'string' ? raw.trim() : ''

  // Try to extract JSON from the model output
  try {
    // Some models may wrap the JSON in markdown or backticks — attempt to find the first {..}
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonText = text.slice(firstBrace, lastBrace + 1)
      const parsed = JSON.parse(jsonText)
      if (typeof parsed?.approved === 'boolean') return parsed.approved
    }
  } catch (e) {
    // fallthrough to heuristics
  }

  // Heuristic fallback: look for affirmative / negative words
  const lower = text.toLowerCase()
  if (/\b(yes|yep|approved|allow|okay|ok)\b/.test(lower)) return true
  if (/\b(no|not|deny|deny|don't|do not|reject)\b/.test(lower)) return false

  // Default conservative answer
  return false
}


export const summarizeMessages = async (messages: AIMessage[]) => {
  const response = await runLLM({
    systemPrompt:
      'Summarize the key points of the conversation in a concise way that would be helpful as context for future interactions. Make it like a play by play of the conversation.',
    messages,
    temperature: 0.3,
  })

  return response.content || ''
}