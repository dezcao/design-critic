export const runtime = "edge";

import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const SYSTEM_PROMPT = `당신은 디자인 평론가입니다.
업로드된 CI(기업 아이덴티티) 이미지와 업종, 디자인 의도를 바탕으로 디자인을 분석합니다.

다음 6가지 항목으로 평가해 주세요:
1. 식별성 — 멀리서, 빠르게, 처음 보는 사람도 인식되는가
2. 단순성 — 불필요한 요소(그라데이션, 과도한 폰트 수, 장식)가 있는가
3. 의미 일치성 — 제작자의 의도와 형태·색이 실제로 부합하는가
4. 내구성 — 3~5년 후에도 시대에 뒤처지지 않을 디자인인가
5. 적용 가능성 — 간판, 명함, 앱 아이콘, 흑백 인쇄 등 다양한 환경에서 작동하는가
6. 업종 적합성 — 해당 업종의 신뢰감, 전문성, 분위기와 일치하는가

각 항목마다 "잘 되고 있는 점 / 개선이 필요한 점 / 구체적 제안" 3단 구조로 서술하세요.
숫자 점수는 부여하지 않습니다.
입력 텍스트의 언어로 응답하세요. 기본값은 한국어입니다.`;

/**
 * 이미지와 텍스트를 받아 Claude에게 디자인 평가를 요청하고 스트리밍으로 반환한다.
 */
export async function POST(req: Request) {
  const formData = await req.formData();

  // 이미지 파일을 base64로 변환
  const imageMessages: { type: "image"; image: string; mimeType: string }[] = [];
  for (const [, value] of formData.entries()) {
    if (value instanceof File && value.type.startsWith("image/")) {
      const buffer = await value.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      imageMessages.push({ type: "image", image: base64, mimeType: value.type });
    }
  }

  const category = (formData.get("category") as string) ?? "";
  const intent = (formData.get("intent") as string) ?? "";
  const target = (formData.get("target") as string) ?? "";

  if (!category.trim()) {
    return new Response("업종을 입력해 주세요.", { status: 400 });
  }

  const userText = [
    `업종: ${category}`,
    intent ? `디자인 의도: ${intent}` : null,
    target ? `타겟 고객: ${target}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          ...imageMessages.map((img) => ({
            type: "image" as const,
            image: img.image,
            mimeType: img.mimeType,
          })),
        ],
      },
    ],
    maxOutputTokens: 4000,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err: unknown) {
        const message = (err as Error)?.message ?? "서버 오류가 발생했습니다.";
        controller.enqueue(encoder.encode(`__ERROR__${message}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
