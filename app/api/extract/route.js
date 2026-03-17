import { callNemotron } from "@/lib/nemotron";
import { EXTRACT_SYSTEM, extractPrompt } from "@/lib/prompts";

export const runtime = "edge";

export async function POST(req) {
  const { doc } = await req.json();
  if (!doc) return new Response("Missing doc", { status: 400 });

  try {
    const raw = await callNemotron(
      [{ role: "user", content: extractPrompt(doc) }],
      EXTRACT_SYSTEM,
      { maxTokens: 800 }
    );

    // Strip possible markdown fences
    const clean = raw.replace(/```json\n?|```\n?/g, "").trim();
    const findings = JSON.parse(clean);

    return Response.json({ findings });
  } catch (e) {
    console.error("Extract error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
