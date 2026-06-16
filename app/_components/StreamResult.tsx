"use client";

import { useState } from "react";

interface StreamResultProps {
  result: string;
  loading: boolean;
  error: string;
}

/**
 * AI 스트리밍 응답을 실시간으로 렌더링하는 컴포넌트.
 */
export default function StreamResult({ result, loading, error }: StreamResultProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!result && !loading) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex justify-end">
        <button
          onClick={handleCopy}
          className={`text-xs transition-colors ${copied ? "text-green-500" : "text-gray-400 hover:text-gray-600"}`}
        >
          {copied ? "복사됨 ✓" : "복사"}
        </button>
      </div>
      {loading && !result && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="animate-pulse">분석 중</span>
          <span className="animate-bounce">...</span>
        </div>
      )}
      {result && (
        <p className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{result}</p>
      )}
    </div>
  );
}
