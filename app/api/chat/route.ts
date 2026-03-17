export const runtime = "nodejs";

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { buildSystemPrompt } from "@/lib/systemPrompt";
import { searchPubMed, searchClinVar, GroundingSource } from "@/lib/grounding";
import { Annotation } from "@/lib/annotate";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://genomic-cancer-analysis.vercel.app",
    "X-Title": "Genomic Cancer Analysis",
  },
});

async function fetchGrounding(annotations: Annotation[]): Promise<GroundingSource[]> {
  // Pick top unique pathogenic genes + biomarkers to search
  const seen = new Set<string>();
  const toSearch: { term: string; type: "pubmed" | "clinvar" }[] = [];

  for (const ann of annotations) {
    const key = ann.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (ann.cls === "pathogenic" || ann.cls === "vus") {
      toSearch.push({ term: ann.text, type: "clinvar" });
      toSearch.push({ term: `${ann.text} cancer treatment`, type: "pubmed" });
    } else if (ann.cls === "biomarker") {
      toSearch.push({ term: `${ann.text} cancer immunotherapy`, type: "pubmed" });
    }
    if (toSearch.length >= 6) break;
  }

  const results = await Promise.allSettled(
    toSearch.map(async ({ term, type }) => {
      if (type === "pubmed") {
        const r = await searchPubMed(term);
        return r.length > 0 ? { tool: "pubmed" as const, query: term, results: r } : null;
      } else {
        const r = await searchClinVar(term);
        return r.length > 0 ? { tool: "clinvar" as const, query: term, results: r } : null;
      }
    })
  );

  const out: GroundingSource[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value !== null) out.push(r.value);
  }
  return out;
}

function buildGroundingContext(sources: GroundingSource[]): string {
  if (sources.length === 0) return "";
  let ctx = "\n\nGROUNDING EVIDENCE FROM EXTERNAL DATABASES:\n";
  for (const src of sources) {
    ctx += `\n[${src.tool === "pubmed" ? "PubMed" : "ClinVar"} — "${src.query}"]\n`;
    for (const r of src.results.slice(0, 3)) {
      if (src.tool === "pubmed") {
        const pm = r as import("@/lib/grounding").PubMedResult;
        ctx += `  • ${pm.title} (${pm.source}, ${pm.pubdate}) — ${pm.url}\n`;
      } else {
        const cv = r as import("@/lib/grounding").ClinVarResult;
        ctx += `  • ${cv.title} — ${cv.clinical_significance} — ${cv.url}\n`;
      }
    }
  }
  ctx += "\nCite these sources in your response where relevant.\n";
  return ctx;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, documentText, annotations = [] } = body;

    if (!documentText) {
      return new Response(JSON.stringify({ error: "No document text provided" }), { status: 400 });
    }

    // Fetch live grounding in parallel with building the prompt
    const sources = await fetchGrounding(annotations as Annotation[]);
    const groundingCtx = buildGroundingContext(sources);
    const systemPrompt = buildSystemPrompt(documentText) + groundingCtx;

    // Strip any non-standard fields from messages before sending to API
    const cleanMessages = (messages as Array<{ role: string; content: string }>).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const stream = await openai.chat.completions.create({
      model: "nvidia/llama-3.1-nemotron-70b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        ...cleanMessages,
      ] as OpenAI.Chat.ChatCompletionMessageParam[],
      stream: true,
      temperature: 0.2,
      max_tokens: 1200,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // First send sources as a JSON line
          if (sources.length > 0) {
            controller.enqueue(encoder.encode(`SOURCES:${JSON.stringify(sources)}\n`));
          }
          // Then stream the model response
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } catch (e) {
          console.error("Streaming error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
