"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface InputFormProps {
  category: string;
  intent: string;
  target: string;
  loading: boolean;
  onCategoryChange: (value: string) => void;
  onIntentChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * 디자인 평가 요청을 위한 텍스트 입력 폼.
 * 업종(필수), 디자인 의도(선택), 타겟 고객(선택)을 받는다.
 */
export default function InputForm({
  category,
  intent,
  target,
  loading,
  onCategoryChange,
  onIntentChange,
  onTargetChange,
  onSubmit,
}: InputFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">
          업종 / 카테고리 <span className="text-red-500">*</span>
        </Label>
        <Input
          id="category"
          placeholder="예: 정육식당, 미용실, 지자체, IT스타트업"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="intent">디자인 의도 설명</Label>
        <Textarea
          id="intent"
          placeholder="색상의 의미, 형태의 의미 등 제작자가 담으려 한 내용을 자유롭게 입력하세요."
          value={intent}
          onChange={(e) => onIntentChange(e.target.value)}
          rows={4}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="target">타겟 고객</Label>
        <Input
          id="target"
          placeholder="예: 중장년층 동네 주민, 20대 직장인"
          value={target}
          onChange={(e) => onTargetChange(e.target.value)}
        />
      </div>

      <Button
        type="button"
        onClick={onSubmit}
        disabled={loading || !category.trim()}
        className="w-full"
      >
        {loading ? "분석 중..." : "디자인 평가 요청"}
      </Button>
    </div>
  );
}
