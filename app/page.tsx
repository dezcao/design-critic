"use client";

import { useState } from "react";
import ImageUploader, { type ImageItem } from "./_components/ImageUploader";
import InputForm from "./_components/InputForm";
import StreamResult from "./_components/StreamResult";

/**
 * Design Critic 메인 페이지.
 * 이미지 업로드 + 텍스트 입력 → AI 스트리밍 평가 결과 표시.
 */
export default function Home() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [category, setCategory] = useState("");
  const [intent, setIntent] = useState("");
  const [target, setTarget] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!category.trim()) return;

    setLoading(true);
    setResult("");
    setError("");

    try {
      const fd = new FormData();
      images.forEach(({ file }) => fd.append("image", file));
      fd.append("category", category);
      fd.append("intent", intent);
      fd.append("target", target);

      const res = await fetch("/api/analyze", { method: "POST", body: fd });

      if (!res.ok) {
        const text = await res.text();
        setError(text || "요청 처리 중 오류가 발생했습니다.");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (accumulated.startsWith("__ERROR__")) {
          setError(accumulated.slice("__ERROR__".length));
          setResult("");
          return;
        }
        setResult(accumulated);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Design Critic</h1>
      <p className="mb-8 text-sm text-gray-500">
        CI 이미지를 업로드하고 업종을 입력하면 디자인 평가를 받을 수 있습니다.
      </p>

      <div className="flex flex-col gap-6">
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-700">이미지</h2>
          <ImageUploader images={images} onChange={setImages} />
        </section>

        <section>
          <InputForm
            category={category}
            intent={intent}
            target={target}
            loading={loading}
            onCategoryChange={setCategory}
            onIntentChange={setIntent}
            onTargetChange={setTarget}
            onSubmit={handleSubmit}
          />
        </section>

        <StreamResult result={result} loading={loading} error={error} />
      </div>
    </main>
  );
}
