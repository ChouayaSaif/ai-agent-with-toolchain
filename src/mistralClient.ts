import fetch from "node-fetch";

export async function generateFromMistral(
  payload: string | any,
  defaultModel: string = "open-mistral-nemo-2407",
): Promise<string | any> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set in environment variables");

  let body: any;
  if (typeof payload === "string") {
    body = {
      model: defaultModel,
      messages: [{ role: "user", content: payload }],
    };
  } else {
    body = payload;
    // ensure there's a model set
    if (!body.model) body.model = defaultModel;
  }

  // Debug: print outgoing body summary
  // try {
  //   console.log('Mistral outgoing body:', JSON.stringify({ model: body.model, messages: (body.messages || []).map((m: any) => ({ role: m.role, content: (m.content || '').slice(0,40) })), tools: body.tools ? body.tools.map((t: any) => t.function?.name || t.name) : undefined, tool_choice: body.tool_choice }, null, 2))
  // } catch (e) {
  //   // ignore
  // }

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Debug: print response body
    try {
      console.error('Mistral error response body:', errorText)
    } catch (e) {}
    throw new Error(`Mistral API error: ${response.status} ${errorText}`);
  }

  // return raw text so callers can parse as they expect
  const text = await response.text();
  return text;
}
