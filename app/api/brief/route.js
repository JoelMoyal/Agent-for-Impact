import { callNemotron } from "@/lib/nemotron";
import { BRIEF_SYSTEM, briefPrompt } from "@/lib/prompts";

export const runtime = "edge";

export async function POST(req) {
  const { doc } = await req.json();
  if (!doc) return new Response("Missing doc", { status: 400 });

  try {
    const raw = await callNemotron(
      [{ role: "user", content: briefPrompt(doc) }],
      BRIEF_SYSTEM,
      { maxTokens: 1200 }
    );

    const clean = raw.replace(/```json\n?|```\n?/g, "").trim();
    const brief = JSON.parse(clean);

    return Response.json({ brief });
  } catch (e) {
    console.error("Brief error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
