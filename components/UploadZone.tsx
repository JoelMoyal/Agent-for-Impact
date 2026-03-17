"use client";

import { useState, useCallback } from "react";

interface Props {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export default function UploadZone({ onUpload, isLoading }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (isLoading) return;
    onUpload(file);
  }, [onUpload, isLoading]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 p-8">
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <span className="text-xs font-semibold tracking-widest text-green-400 uppercase">Powered by NVIDIA Nemotron</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">Genomic Cancer Analysis</h1>
        <p className="text-gray-400 text-lg max-w-xl">
          Upload a genomic report or cancer panel result. The AI agent will extract mutations,
          classify biomarkers, and explain findings grounded in published evidence.
        </p>
      </div>

      {/* Use <label> — works in all browsers without JS click() */}
      <label
        htmlFor="genomic-file-input"
        onDragOver={(e) => { e.preventDefault(); if (!isLoading) setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`
          relative w-full max-w-2xl border-2 border-dashed rounded-2xl p-16
          flex flex-col items-center justify-center gap-4
          transition-all duration-200 select-none
          ${isLoading
            ? "opacity-60 cursor-not-allowed border-gray-700 bg-gray-900/60"
            : isDragOver
              ? "border-green-400 bg-green-500/10 scale-[1.02] cursor-copy"
              : "border-gray-700 bg-gray-900/60 hover:border-gray-500 hover:bg-gray-900 cursor-pointer"
          }
        `}
      >
        <input
          id="genomic-file-input"
          type="file"
          accept=".pdf,.txt,.md"
          className="sr-only"
          onChange={handleInputChange}
          disabled={isLoading}
        />

        {isLoading ? (
          <>
            <div className="w-12 h-12 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-300 text-lg font-medium">Analyzing document...</p>
            <p className="text-gray-500 text-sm">Extracting mutations · querying PubMed + ClinVar</p>
          </>
        ) : (
          <>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragOver ? "bg-green-500/20" : "bg-gray-800"}`}>
              <svg className={`w-8 h-8 transition-colors ${isDragOver ? "text-green-400" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white text-lg font-semibold mb-1">
                {isDragOver ? "Drop to analyze" : "Drop your genomic report here"}
              </p>
              <p className="text-gray-400">or <span className="text-green-400 underline underline-offset-2">click to browse</span></p>
            </div>
            <p className="text-gray-600 text-sm">PDF, TXT, or Markdown — up to 10MB</p>
          </>
        )}
      </label>

      <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl">
        {[
          { label: "Pathogenic mutations", cls: "text-red-300", dot: "bg-red-400", examples: "BRCA1/2, TP53, EGFR" },
          { label: "VUS / uncertain",       cls: "text-yellow-300", dot: "bg-yellow-400", examples: "ATM, CHEK2, PALB2" },
          { label: "Benign variants",       cls: "text-green-300", dot: "bg-green-400", examples: "Likely benign calls" },
          { label: "Biomarkers",            cls: "text-blue-300",  dot: "bg-blue-400",  examples: "TMB, MSI, PD-L1, HRD" },
        ].map(({ label, cls, dot, examples }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className={`w-2 h-2 rounded-full mb-2 ${dot}`} />
            <p className={`text-xs font-semibold mb-1 ${cls}`}>{label}</p>
            <p className="text-gray-500 text-xs">{examples}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
