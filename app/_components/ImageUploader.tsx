"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export interface ImageItem {
  file: File;
  url: string;
}

interface ImageUploaderProps {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
}

/**
 * 이미지 업로드 컴포넌트.
 * 카메라 촬영, 파일 선택, 클립보드 붙여넣기 세 가지 방식을 지원한다.
 */
export default function ImageUploader({ images, onChange }: ImageUploaderProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** FileList를 ImageItem 배열로 변환하여 기존 목록에 추가 */
  function addFiles(fileList: FileList | null) {
    const newImages = Array.from(fileList ?? [])
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    onChange([...images, ...newImages]);
  }

  /** 특정 인덱스의 이미지를 제거하고 Object URL을 해제 */
  function removeImage(index: number) {
    const removed = images[index];
    URL.revokeObjectURL(removed.url);
    onChange(images.filter((_, i) => i !== index));
  }

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const newImages = Array.from(e.clipboardData?.items ?? [])
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null)
        .map((file) => ({ file, url: URL.createObjectURL(file) }));
      if (newImages.length > 0) onChange([...images, ...newImages]);
    }

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [images, onChange]);

  useEffect(() => {
    return () => {
      images.forEach(({ url }) => URL.revokeObjectURL(url));
    };
    // cleanup on unmount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-lg border-2 border-dashed border-gray-300 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cameraRef.current?.click()}
        >
          카메라로 촬영
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
        >
          파일 선택
        </Button>
        <span className="text-sm text-gray-400">또는 Ctrl+V로 붙여넣기</span>
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map(({ url }, i) => (
            <div key={url} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`업로드 이미지 ${i + 1}`}
                className="h-20 w-20 rounded object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute right-0 top-0 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex [@media(hover:none)]:flex [@media(hover:none)]:h-6 [@media(hover:none)]:w-6"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 카메라 캡처용 — 모바일에서 카메라 앱 직접 실행 */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      {/* 파일 탐색기용 — 폴더에서 선택 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
    </div>
  );
}
