"use client";

import { useState, useCallback, useRef } from "react";
import UploadZone from "@/components/UploadZone";
import DocumentViewer from "@/components/DocumentViewer";
import ChatPanel from "@/components/ChatPanel";
import { Message } from "@/components/MessageBubble";
import { Annotation } from "@/lib/annotate";
import { GroundingSource } from "@/lib/grounding";

type AppState = "idle" | "uploading" | "analyzing";

interface DocData {
  text: string;
  filename: string;
  annotations: Annotation[];
}

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [doc, setDoc] = useState<DocData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setError(null);
    setState("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const docData: DocData = {
        text: data.text,
        filename: data.filename,
        annotations: data.annotations,
      };
      setDoc(docData);
      setMessages([]);
      setState("analyzing");

      await streamAssistantMessage(
        [{ role: "user", content: "Please analyze this genomic report. Summarize all key findings, mutations, biomarkers, and their clinical significance. Use your search tools to ground your answer in published evidence." }],
        docData,
        true
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("idle");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const streamAssistantMessage = useCallback(
    async (msgs: Message[], docData: DocData, isAutoTrigger = false) => {
      setIsStreaming(true);
      const controller = new AbortController();
      streamAbortRef.current = controller;

      if (!isAutoTrigger) {
        setMessages((prev) => [...prev, msgs[msgs.length - 1]]);
      } else {
        setMessages([]);
      }

      // Add empty assistant placeholder
      setMessages((prev) => [...prev, { role: "assistant", content: "", sources: [] }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: msgs,
            documentText: docData.text,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Chat request failed");
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sourcesExtracted = false;
        let sources: GroundingSource[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Extract SOURCES: line from the beginning of the stream
          if (!sourcesExtracted) {
            const newlineIdx = buffer.indexOf("\n");
            if (newlineIdx !== -1) {
              const firstLine = buffer.slice(0, newlineIdx);
              if (firstLine.startsWith("SOURCES:")) {
                try {
                  sources = JSON.parse(firstLine.slice("SOURCES:".length)) as GroundingSource[];
                } catch { /* ignore parse errors */ }
                buffer = buffer.slice(newlineIdx + 1);
              }
              sourcesExtracted = true;
            } else if (!buffer.startsWith("SOURCES:") && buffer.length > 10) {
              // No sources line coming
              sourcesExtracted = true;
            }
          }

          if (sourcesExtracted && buffer.length > 0) {
            const toFlush = buffer;
            buffer = "";
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + toFlush,
                  sources: sources.length > 0 ? sources : last.sources,
                };
              }
              return updated;
            });
          }
        }

        // Flush any remaining buffer
        if (buffer.length > 0) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + buffer,
                sources: sources.length > 0 ? sources : last.sources,
              };
            }
            return updated;
          });
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant" && last.content === "") {
              updated[updated.length - 1] = {
                ...last,
                content: "Sorry, I encountered an error. Please try again.",
              };
            }
            return updated;
          });
        }
      } finally {
        setIsStreaming(false);
        streamAbortRef.current = null;
      }
    },
    []
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!doc || isStreaming) return;
      const newUserMsg: Message = { role: "user", content: text };
      const updatedMsgs = [...messages, newUserMsg];
      setMessages(updatedMsgs);
      await streamAssistantMessage(updatedMsgs, doc);
    },
    [doc, isStreaming, messages, streamAssistantMessage]
  );

  const handleAnnotationClick = useCallback(
    (ann: { id: string; text: string }) => {
      setActiveAnnotationId(ann.id);
      if (!isStreaming && doc) {
        handleSend(`Tell me more about ${ann.text} found in the document. Search for recent evidence on its clinical significance and treatment implications.`);
      }
    },
    [isStreaming, doc, handleSend]
  );

  const handleMutationClickInChat = useCallback((annId: string) => {
    setActiveAnnotationId(annId);
    setTimeout(() => setActiveAnnotationId(null), 4000);
  }, []);

  const handleReset = useCallback(() => {
    streamAbortRef.current?.abort();
    setDoc(null);
    setMessages([]);
    setActiveAnnotationId(null);
    setError(null);
    setState("idle");
  }, []);

  if (state === "idle" || state === "uploading") {
    return (
      <div className="relative">
        <UploadZone onUpload={handleUpload} isLoading={state === "uploading"} />
        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-700 text-red-200 px-5 py-3 rounded-xl text-sm shadow-xl">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <h1 className="text-sm font-semibold text-white">Genomic Cancer Analysis</h1>
          <span className="text-xs text-gray-600">·</span>
          <span className="text-xs text-gray-500 font-mono">{doc?.filename}</span>
        </div>
        <div className="flex items-center gap-3">
          {doc && doc.annotations.length > 0 && (
            <div className="hidden md:flex items-center gap-2">
              {Object.entries(
                doc.annotations.reduce((acc, a) => {
                  acc[a.cls] = (acc[a.cls] ?? 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([cls, count]) => (
                <span
                  key={cls}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${cls === "pathogenic" ? "bg-red-500/20 text-red-300" : ""}
                    ${cls === "vus" ? "bg-yellow-500/20 text-yellow-300" : ""}
                    ${cls === "benign" ? "bg-green-500/20 text-green-300" : ""}
                    ${cls === "biomarker" ? "bg-blue-500/20 text-blue-300" : ""}
                  `}
                >
                  {count} {cls}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            PubMed + ClinVar grounded
          </div>
          <span className="text-xs text-gray-600 hidden md:block">NVIDIA Nemotron</span>
        </div>
      </header>

      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[55%_45%]">
        {doc && (
          <DocumentViewer
            text={doc.text}
            filename={doc.filename}
            annotations={doc.annotations}
            activeAnnotationId={activeAnnotationId}
            onAnnotationClick={handleAnnotationClick}
          />
        )}
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          annotations={doc?.annotations ?? []}
          onSend={handleSend}
          onMutationClick={handleMutationClickInChat}
          onReset={handleReset}
        />
      </div>
    </div>
  );
}
