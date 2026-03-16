export const runtime = "nodejs";

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { buildSystemPrompt } from "@/lib/systemPrompt";
import { searchPubMed, searchClinVar, GroundingSource } from "@/lib/grounding";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://genomic-cancer-analysis.vercel.app",
    "X-Title": "Genomic Cancer Analysis",
  },
});

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_pubmed",
      description:
        "Search PubMed for peer-reviewed literature about a mutation, gene, biomarker, or cancer treatment. Use this to ground your answer in real published evidence.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Specific search query e.g. 'EGFR exon 19 deletion osimertinib NSCLC' or 'BRCA2 pathogenic breast cancer PARP inhibitor'",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_clinvar",
      description:
        "Search ClinVar for clinical variant classifications and pathogenicity evidence for a specific gene or variant.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Gene and variant query e.g. 'EGFR pathogenic' or 'BRCA2 p.Tyr42Cys' or 'TP53 R175H'",
          },
        },
        required: ["query"],
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, string>): Promise<{ result: unknown; source: GroundingSource }> {
  if (name === "search_pubmed") {
    const results = await searchPubMed(args.query);
    return {
      result: results,
      source: { tool: "pubmed", query: args.query, results },
    };
  }
  if (name === "search_clinvar") {
    const results = await searchClinVar(args.query);
    return {
      result: results,
      source: { tool: "clinvar", query: args.query, results },
    };
  }
  return { result: [], source: { tool: "pubmed", query: "", results: [] } };
}

export async function POST(req: NextRequest) {
  try {
    const { messages, documentText } = await req.json();

    if (!documentText) {
      return new Response(JSON.stringify({ error: "No document text provided" }), { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(documentText);
    const allSources: GroundingSource[] = [];

    // Agentic loop: let Nemotron call tools until it has enough grounding
    const loopMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    let iterations = 0;
    const MAX_ITERATIONS = 4;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await openai.chat.completions.create({
        model: "nvidia/llama-3.1-nemotron-70b-instruct",
        messages: loopMessages,
        tools: TOOLS,
        tool_choice: iterations === 1 ? "auto" : "auto",
        temperature: 0.2,
        max_tokens: 1500,
        stream: false,
      });

      const choice = response.choices[0];
      const assistantMsg = choice.message;

      loopMessages.push(assistantMsg);

      // No tool calls — model is done reasoning, stream the final answer
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        break;
      }

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        assistantMsg.tool_calls.map(async (tc) => {
          const args = JSON.parse(tc.function.arguments) as Record<string, string>;
          const { result, source } = await executeTool(tc.function.name, args);
          if (source.results.length > 0) allSources.push(source);
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          };
        })
      );

      loopMessages.push(...toolResults);
    }

    // Get the final answer content (either from loop exit or last assistant message)
    const lastAssistant = [...loopMessages].reverse().find((m) => m.role === "assistant");
    const finalContent =
      typeof lastAssistant?.content === "string" ? lastAssistant.content : "";

    // Stream: first send sources JSON line, then the answer
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        // Send sources as first line (client parses this)
        if (allSources.length > 0) {
          const sourcesLine = `SOURCES:${JSON.stringify(allSources)}\n`;
          controller.enqueue(encoder.encode(sourcesLine));
        }

        // If we have a final content from the non-streaming loop, stream it char by char
        if (finalContent) {
          // Stream in chunks to simulate streaming feel
          const chunkSize = 8;
          for (let i = 0; i < finalContent.length; i += chunkSize) {
            controller.enqueue(encoder.encode(finalContent.slice(i, i + chunkSize)));
            // Small delay for streaming effect
            await new Promise((r) => setTimeout(r, 10));
          }
          controller.close();
          return;
        }

        // Fallback: stream a fresh response if no content yet
        const stream = await openai.chat.completions.create({
          model: "nvidia/llama-3.1-nemotron-70b-instruct",
          messages: loopMessages,
          temperature: 0.2,
          max_tokens: 1200,
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
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
    return new Response(JSON.stringify({ error: "Failed to generate response" }), { status: 500 });
  }
}
