"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface Props {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export default function UploadZone({ onUpload, isLoading }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onUpload(accepted[0]);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 p-8">
      {/* Header */}
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
          classify biomarkers, and explain findings grounded in your document.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          relative w-full max-w-2xl border-2 border-dashed rounded-2xl p-16
          flex flex-col items-center justify-center gap-4 cursor-pointer
          transition-all duration-200
          ${isDragOver
            ? "border-green-400 bg-green-500/10 scale-[1.02]"
            : "border-gray-700 bg-gray-900/60 hover:border-gray-500 hover:bg-gray-900"
          }
          ${isLoading ? "opacity-60 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />

        {isLoading ? (
          <>
            <div className="w-12 h-12 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-300 text-lg font-medium">Analyzing document...</p>
            <p className="text-gray-500 text-sm">Extracting text and detecting mutations</p>
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
      </div>

      {/* What it detects */}
      <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl">
        {[
          { label: "Pathogenic mutations", color: "red", examples: "BRCA1/2, TP53, EGFR" },
          { label: "VUS / uncertain", color: "yellow", examples: "ATM, CHEK2, PALB2" },
          { label: "Benign variants", color: "green", examples: "Likely benign calls" },
          { label: "Biomarkers", color: "blue", examples: "TMB, MSI, PD-L1, HRD" },
        ].map(({ label, color, examples }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className={`w-2 h-2 rounded-full mb-2 bg-${color}-400`} />
            <p className={`text-${color}-300 text-xs font-semibold mb-1`}>{label}</p>
            <p className="text-gray-500 text-xs">{examples}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
