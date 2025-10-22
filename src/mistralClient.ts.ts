import fetch from "node-fetch";

export async function generateFromMistral(prompt: string, model: string = "open-mistral-nemo-2407"): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set in environment variables");

  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
  };

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
    throw new Error(`Mistral API error: ${response.status} ${errorText}`);
  }

  type MistralResponse = { choices?: { message?: { content?: string } }[] };
  const data = (await response.json()) as MistralResponse;
  return data.choices?.[0]?.message?.content ?? "";
}
