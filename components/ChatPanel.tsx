"use client";

import { useRef, useEffect, useState, KeyboardEvent } from "react";
import MessageBubble, { Message } from "./MessageBubble";
import { Annotation } from "@/lib/annotate";

interface Props {
  messages: Message[];
  isStreaming: boolean;
  annotations: Annotation[];
  onSend: (text: string) => void;
  onMutationClick: (annId: string) => void;
  onReset: () => void;
}

const SUGGESTED_QUESTIONS = [
  "What are the key mutations found?",
  "Are there any actionable findings?",
  "What treatment options do these mutations suggest?",
  "Explain the biomarkers in this report",
];

export default function ChatPanel({
  messages,
  isStreaming,
  annotations,
  onSend,
  onMutationClick,
  onReset,
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-semibold text-gray-200">Nemotron Analysis Agent</span>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          New report
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            annotations={annotations}
            onMutationClick={onMutationClick}
          />
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-green-500/20 text-green-400 flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5">
              AI
            </div>
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions (show only before first user message) */}
      {messages.filter((m) => m.role === "user").length === 0 && !isStreaming && (
        <div className="px-4 pb-3 flex flex-col gap-2 flex-shrink-0">
          <p className="text-xs text-gray-600 font-medium">Suggested questions</p>
          <div className="grid grid-cols-1 gap-1.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onSend(q)}
                className="text-left text-xs text-gray-400 hover:text-gray-200 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="flex gap-2 items-end bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 focus-within:border-green-500/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about mutations, biomarkers, treatments..."
            rows={1}
            className="flex-1 bg-transparent text-gray-200 placeholder-gray-600 text-sm resize-none outline-none leading-relaxed min-h-[24px]"
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors mb-0.5"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-700 mt-1.5 text-center">
          Powered by NVIDIA Nemotron via OpenRouter · Not for clinical use
        </p>
      </div>
    </div>
  );
}
