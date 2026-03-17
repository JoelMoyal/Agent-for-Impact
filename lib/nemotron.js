const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MODEL = "nvidia/llama-3.1-nemotron-70b-instruct";

/**
 * Call Nemotron via OpenRouter and return the full text response.
 */
export async function callNemotron(messages, system, opts = {}) {
  const payload = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1500,
    messages: [
      { role: "system", content: system },
      ...messages,
    ],
  };

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://vaxagent.vercel.app",
      "X-Title": "VaxAgent",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Nemotron error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Stream Nemotron response back — returns a ReadableStream of SSE chunks.
 */
export async function streamNemotron(messages, system) {
  const payload = {
    model: MODEL,
    max_tokens: 1500,
    stream: true,
    messages: [
      { role: "system", content: system },
      ...messages,
    ],
  };

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://vaxagent.vercel.app",
      "X-Title": "VaxAgent",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Nemotron stream error ${res.status}: ${err}`);
  }

  return res.body;
}
