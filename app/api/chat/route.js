import { callNemotron, streamNemotron } from "@/lib/nemotron";
import { searchLiterature, buildSearchQuery } from "@/lib/search";
import {
  CHAT_SYSTEM,
  SEARCH_ROUTING_SYSTEM,
  searchRoutingPrompt,
} from "@/lib/prompts";

export const runtime = "edge";

export async function POST(req) {
  const { messages, doc, findings } = await req.json();

  if (!messages?.length || !doc) {
    return new Response("Missing messages or doc", { status: 400 });
  }

  const lastMessage = messages[messages.length - 1].content;

  // ── Step 1: Route — does this need a web search? ─────────────────────────
  let needsSearch = false;
  try {
    const routingResult = await callNemotron(
      [{ role: "user", content: searchRoutingPrompt(lastMessage) }],
      SEARCH_ROUTING_SYSTEM,
      { maxTokens: 5 }
    );
    needsSearch = routingResult.trim().toLowerCase().startsWith("search");
  } catch {
    needsSearch = false;
  }

  // ── Step 2: MCP web search (Tavily) if needed ────────────────────────────
  let retrievedContext = "";
  if (needsSearch) {
    try {
      const query = buildSearchQuery(lastMessage, findings);
      const results = await searchLiterature(query);
      if (results) retrievedContext = results;
    } catch (e) {
      console.error("Search failed, continuing without grounding:", e);
    }
  }

  // ── Step 3: Stream Nemotron response ─────────────────────────────────────
  const systemPrompt = CHAT_SYSTEM(doc, retrievedContext);

  // Build clean message list (role: user/assistant only)
  const cleanMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const upstreamBody = await streamNemotron(cleanMessages, systemPrompt);

    // Prefix the stream with a metadata event so the client knows if we searched
    const encoder = new TextEncoder();
    const metaChunk = encoder.encode(
      `data: ${JSON.stringify({ type: "meta", searched: needsSearch, query: needsSearch ? buildSearchQuery(lastMessage, findings) : null })}\n\n`
    );

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    (async () => {
      await writer.write(metaChunk);

      const reader = upstreamBody.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Pass through raw SSE chunks from OpenRouter
        const text = decoder.decode(value, { stream: true });
        await writer.write(encoder.encode(text));
      }
      await writer.close();
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Searched": needsSearch ? "1" : "0",
      },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
