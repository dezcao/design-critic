export const runtime = "edge";

import { SYSTEM_PROMPT } from "@/lib/sieve/systemPrompt";

/**
 * 이미지와 텍스트를 받아 Claude에게 디자인 평가를 요청하고 스트리밍으로 반환한다.
 * Cloudflare Pages 엣지 런타임 호환을 위해 Anthropic API 직접 호출 + SSE 수동 파싱 사용.
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

  const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            ...imageMessages.map((img) => ({
              type: "image",
              source: { type: "base64", media_type: img.mimeType, data: img.image },
            })),
          ],
        },
      ],
    }),
  });

  const encoder = new TextEncoder();

  if (!apiRes.ok) {
    const errText = await apiRes.text();
    return new Response(`__ERROR__Claude API 오류 (${apiRes.status}): ${errText}`, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = apiRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            try {
              const json = JSON.parse(data);
              const delta = json?.delta?.text;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // 이벤트 메타데이터 등 파싱 불필요한 줄 무시
            }
          }
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
