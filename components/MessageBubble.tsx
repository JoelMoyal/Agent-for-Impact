"use client";

import { useState } from "react";
import { Annotation } from "@/lib/annotate";
import { GroundingSource, PubMedResult, ClinVarResult } from "@/lib/grounding";

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: GroundingSource[];
}

interface Props {
  message: Message;
  annotations: Annotation[];
  onMutationClick: (annId: string) => void;
}

function renderWithHighlights(
  content: string,
  annotations: Annotation[],
  onMutationClick: (annId: string) => void
): React.ReactNode {
  if (annotations.length === 0) return <span className="whitespace-pre-wrap">{content}</span>;

  const termMap = new Map<string, string>();
  for (const ann of annotations) {
    const term = ann.text.trim();
    if (term && !termMap.has(term.toLowerCase())) {
      termMap.set(term.toLowerCase(), ann.id);
    }
  }

  const terms = Array.from(termMap.keys()).sort((a, b) => b.length - a.length);
  if (terms.length === 0) return <span className="whitespace-pre-wrap">{content}</span>;

  const pattern = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  const parts = content.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const annId = termMap.get(part.toLowerCase());
        if (annId) {
          return (
            <button
              key={i}
              onClick={() => onMutationClick(annId)}
              className="underline underline-offset-2 decoration-dotted text-green-300 hover:text-green-200 font-medium transition-colors"
              title="Click to highlight in document"
            >
              {part}
            </button>
          );
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>;
      })}
    </>
  );
}

function SourcesPanel({ sources }: { sources: GroundingSource[] }) {
  const [open, setOpen] = useState(false);
  const totalCount = sources.reduce((n, s) => n + s.results.length, 0);
  if (totalCount === 0) return null;

  return (
    <div className="mt-2 border border-gray-700 rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800/60 hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors text-left"
      >
        <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-blue-300 font-medium">
          {totalCount} grounding source{totalCount !== 1 ? "s" : ""}
        </span>
        <span className="text-gray-600">
          {sources.map((s) => s.tool === "pubmed" ? "PubMed" : "ClinVar").filter((v, i, a) => a.indexOf(v) === i).join(" · ")}
        </span>
        <svg
          className={`w-3 h-3 ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="divide-y divide-gray-800">
          {sources.map((src, si) => (
            <div key={si} className="px-3 py-2 bg-gray-900/40">
              <p className="text-gray-500 mb-1.5 flex items-center gap-1.5">
                <span className={`font-semibold ${src.tool === "pubmed" ? "text-blue-400" : "text-purple-400"}`}>
                  {src.tool === "pubmed" ? "PubMed" : "ClinVar"}
                </span>
                <span className="text-gray-600">·</span>
                <span className="italic">{src.query}</span>
              </p>
              <ul className="space-y-1">
                {src.results.slice(0, 4).map((r, ri) => {
                  const isPubMed = src.tool === "pubmed";
                  const res = r as (PubMedResult | ClinVarResult);
                  return (
                    <li key={ri}>
                      <a
                        href={"url" in res ? res.url : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 hover:text-white hover:underline transition-colors line-clamp-2 leading-snug"
                      >
                        {isPubMed
                          ? (res as PubMedResult).title
                          : `${(res as ClinVarResult).title} — ${(res as ClinVarResult).clinical_significance}`}
                      </a>
                      {isPubMed && (
                        <span className="text-gray-600 ml-1">
                          {(res as PubMedResult).source} {(res as PubMedResult).pubdate}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message, annotations, onMutationClick }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${
          isUser ? "bg-indigo-500/30 text-indigo-300" : "bg-green-500/20 text-green-400"
        }`}
      >
        {isUser ? "U" : "AI"}
      </div>

      <div className={`max-w-[85%] ${isUser ? "" : "flex-1"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-indigo-600/30 text-gray-100 rounded-tr-sm"
              : "bg-gray-800 text-gray-200 rounded-tl-sm"
          }`}
        >
          {isUser
            ? <span className="whitespace-pre-wrap">{message.content}</span>
            : renderWithHighlights(message.content, annotations, onMutationClick)
          }
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesPanel sources={message.sources} />
        )}
      </div>
    </div>
  );
}
