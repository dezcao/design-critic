export const runtime = "edge";

import { SYSTEM_PROMPT } from "@/lib/sieve/systemPrompt";

const SUPPORTED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** File.type은 확장자 기반이라 실제 포맷과 다를 수 있으므로 매직 바이트로 판별한다. */
function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

/**
 * 이미지와 텍스트를 받아 Claude에게 디자인 평가를 요청하고 스트리밍으로 반환한다.
 * Cloudflare Pages 엣지 런타임 호환을 위해 Anthropic API 직접 호출 + SSE 수동 파싱 사용.
 */
export async function POST(req: Request) {
  const formData = await req.formData();

  // 이미지 파일을 base64로 변환 — MIME 타입은 매직 바이트로 탐지해 File.type 불일치를 보정한다
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
      const mimeType = detectMimeType(bytes) ?? value.type;
      if (!SUPPORTED_MIME.has(mimeType)) {
        return new Response(
          `지원하지 않는 이미지 형식입니다 (${mimeType}). JPEG, PNG, GIF, WebP만 업로드할 수 있습니다.`,
          { status: 400 }
        );
      }
      imageMessages.push({ type: "image", image: base64, mimeType });
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
