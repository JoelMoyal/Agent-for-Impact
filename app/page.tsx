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
  const abortRef = useRef<AbortController | null>(null);
  // Keep a ref to the latest doc so callbacks always see fresh value
  const docRef = useRef<DocData | null>(null);

  const streamAssistantMessage = useCallback(
    async (msgs: Message[], docData: DocData, isAutoTrigger = false) => {
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      if (!isAutoTrigger) {
        setMessages((prev) => [...prev, msgs[msgs.length - 1]]);
      } else {
        setMessages([]);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: "", sources: [] }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: msgs.map((m) => ({ role: m.role, content: m.content })),
            documentText: docData.text,
            annotations: docData.annotations,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`API error: ${errText}`);
        }
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

          if (!sourcesExtracted) {
            const nl = buffer.indexOf("\n");
            if (nl !== -1) {
              const firstLine = buffer.slice(0, nl);
              if (firstLine.startsWith("SOURCES:")) {
                try { sources = JSON.parse(firstLine.slice("SOURCES:".length)); } catch { /* ok */ }
                buffer = buffer.slice(nl + 1);
              }
              sourcesExtracted = true;
            } else if (!buffer.startsWith("SOURCES:") && buffer.length > 20) {
              sourcesExtracted = true;
            }
          }

          if (sourcesExtracted && buffer.length > 0) {
            const flush = buffer;
            buffer = "";
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + flush,
                  sources: sources.length > 0 ? sources : last.sources,
                };
              }
              return updated;
            });
          }
        }

        if (buffer.length > 0) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: last.content + buffer, sources };
            }
            return updated;
          });
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const errMsg = err instanceof Error ? err.message : "An error occurred";
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: `Error: ${errMsg}` };
          }
          return updated;
        });
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [] // stable — uses docData param, not closure
  );

  const handleUpload = useCallback(async (file: File) => {
    setError(null);
    setState("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const docData: DocData = { text: data.text, filename: data.filename, annotations: data.annotations };
      docRef.current = docData;
      setDoc(docData);
      setMessages([]);
      setState("analyzing");

      await streamAssistantMessage(
        [{ role: "user", content: "Please analyze this genomic report. Summarize all key findings: mutations, biomarkers, pathogenicity classifications, and treatment implications. Ground your answer in the provided evidence." }],
        docData,
        true
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("idle");
    }
  }, [streamAssistantMessage]);

  const handleSend = useCallback(async (text: string) => {
    const currentDoc = docRef.current;
    if (!currentDoc || isStreaming) return;
    const newMsg: Message = { role: "user", content: text };
    setMessages((prev) => {
      const updated = [...prev, newMsg];
      // fire async, can't await inside setState
      streamAssistantMessage(updated, currentDoc, false);
      return updated;
    });
  }, [isStreaming, streamAssistantMessage]);

  const handleAnnotationClick = useCallback((ann: Annotation) => {
    setActiveAnnotationId(ann.id);
    const currentDoc = docRef.current;
    if (!isStreaming && currentDoc) {
      const msg: Message = { role: "user", content: `Tell me more about ${ann.text} found in the document. Include its clinical significance and any treatment implications.` };
      setMessages((prev) => {
        const updated = [...prev, msg];
        streamAssistantMessage(updated, currentDoc, false);
        return updated;
      });
    }
  }, [isStreaming, streamAssistantMessage]);

  const handleMutationClickInChat = useCallback((annId: string) => {
    setActiveAnnotationId(annId);
    setTimeout(() => setActiveAnnotationId(null), 4000);
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    docRef.current = null;
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
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-700 text-red-200 px-5 py-3 rounded-xl text-sm shadow-xl max-w-md text-center">
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
          <span className="text-xs text-gray-500 font-mono truncate max-w-[200px]">{doc?.filename}</span>
        </div>
        <div className="flex items-center gap-3">
          {doc && doc.annotations.length > 0 && (
            <div className="hidden md:flex items-center gap-2">
              {Object.entries(
                doc.annotations.reduce((acc, a) => { acc[a.cls] = (acc[a.cls] ?? 0) + 1; return acc; }, {} as Record<string, number>)
              ).map(([cls, count]) => (
                <span key={cls} className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${cls === "pathogenic" ? "bg-red-500/20 text-red-300" : ""}
                  ${cls === "vus" ? "bg-yellow-500/20 text-yellow-300" : ""}
                  ${cls === "benign" ? "bg-green-500/20 text-green-300" : ""}
                  ${cls === "biomarker" ? "bg-blue-500/20 text-blue-300" : ""}
                `}>{count} {cls}</span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            PubMed + ClinVar grounded
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-row min-w-0">
        {doc && (
          <div className="w-[55%] min-w-0 flex-shrink-0 overflow-hidden">
            <DocumentViewer
              text={doc.text}
              filename={doc.filename}
              annotations={doc.annotations}
              activeAnnotationId={activeAnnotationId}
              onAnnotationClick={handleAnnotationClick}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 overflow-hidden border-l border-gray-800">
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
    </div>
  );
}
