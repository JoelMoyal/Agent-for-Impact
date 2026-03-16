"use client";

import { useRef, useEffect, useCallback } from "react";
import { Annotation, CLS_STYLES, CLS_LABELS, AnnotationClass } from "@/lib/annotate";

interface Props {
  text: string;
  filename: string;
  annotations: Annotation[];
  activeAnnotationId: string | null;
  onAnnotationClick: (ann: Annotation) => void;
}

const CLS_DOT: Record<AnnotationClass, string> = {
  pathogenic: "bg-red-400",
  vus: "bg-yellow-400",
  benign: "bg-green-400",
  biomarker: "bg-blue-400",
};

export default function DocumentViewer({
  text,
  filename,
  annotations,
  activeAnnotationId,
  onAnnotationClick,
}: Props) {
  const spanRefs = useRef<Record<string, HTMLElement | null>>({});

  // Scroll to + pulse the active annotation
  useEffect(() => {
    if (!activeAnnotationId) return;
    const el = spanRefs.current[activeAnnotationId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("animate-pulse-highlight");
      void el.offsetWidth; // force reflow
      el.classList.add("animate-pulse-highlight");
    }
  }, [activeAnnotationId]);

  const renderAnnotatedText = useCallback(() => {
    if (annotations.length === 0) {
      return <span className="whitespace-pre-wrap text-gray-300 leading-relaxed">{text}</span>;
    }

    const parts: React.ReactNode[] = [];
    let cursor = 0;

    for (const ann of annotations) {
      if (ann.start > cursor) {
        parts.push(
          <span key={`text-${cursor}`} className="whitespace-pre-wrap text-gray-300 leading-relaxed">
            {text.slice(cursor, ann.start)}
          </span>
        );
      }
      parts.push(
        <span
          key={ann.id}
          ref={(el) => { spanRefs.current[ann.id] = el; }}
          className={`rounded px-0.5 ${CLS_STYLES[ann.cls]}`}
          title={`${CLS_LABELS[ann.cls]}: ${ann.text}`}
          onClick={() => onAnnotationClick(ann)}
        >
          {ann.text}
        </span>
      );
      cursor = ann.end;
    }

    if (cursor < text.length) {
      parts.push(
        <span key={`text-end`} className="whitespace-pre-wrap text-gray-300 leading-relaxed">
          {text.slice(cursor)}
        </span>
      );
    }

    return parts;
  }, [text, annotations, onAnnotationClick]);

  // Counts per class
  const counts: Partial<Record<AnnotationClass, number>> = {};
  for (const ann of annotations) {
    counts[ann.cls] = (counts[ann.cls] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-medium text-gray-200 truncate">{filename}</span>
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{annotations.length} findings</span>
      </div>

      {/* Legend */}
      {annotations.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-800 flex gap-3 flex-wrap flex-shrink-0">
          {(Object.entries(counts) as [AnnotationClass, number][]).map(([cls, count]) => (
            <div key={cls} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${CLS_DOT[cls]}`} />
              <span className="text-xs text-gray-400">{CLS_LABELS[cls]} ({count})</span>
            </div>
          ))}
        </div>
      )}

      {/* Document text */}
      <div className="flex-1 overflow-y-auto px-5 py-4 font-mono text-sm leading-7">
        {renderAnnotatedText()}
      </div>
    </div>
  );
}
