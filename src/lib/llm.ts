/**
 * LLM 추상화 레이어
 *
 * 현재: Gemini 3 Flash Preview (무료 MVP 테스트)
 * 전환 시: 이 파일의 구현만 교체하면 됨 (함수 시그니처 유지)
 *
 * 지원 예정: Claude, GPT-4o, Gemini Pro 등
 */

import { GoogleGenAI } from "@google/genai";

// ============================================================
// 설정 — 모델 교체 시 여기만 변경
// ============================================================
const MODEL = "gemini-3-flash-preview";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Gemini 3 Flash는 thinking 모델 — thinking을 유지하되
// 출력에서는 thought 파트를 필터링하여 최종 답변만 전달
const THINKING_CONFIG = { thinkingBudget: 2048 };

// ============================================================
// 일반 채팅 (비스트리밍)
// ============================================================
export async function chat(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 4096,
      thinkingConfig: THINKING_CONFIG,
    },
  });

  // thought 파트 제외, 텍스트만 추출
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("");
}

// ============================================================
// 스트리밍 채팅 — { text, truncated } 반환
// ============================================================
export interface StreamChunk {
  text?: string;
  truncated?: boolean;
}

export async function* streamChat(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  options?: { temperature?: number; maxTokens?: number }
): AsyncGenerator<StreamChunk> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const stream = await ai.models.generateContentStream({
    model: MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 4096,
      thinkingConfig: THINKING_CONFIG,
    },
  });

  let lastFinishReason: string | undefined;

  for await (const chunk of stream) {
    // finishReason 추적
    const candidate = chunk.candidates?.[0];
    if (candidate?.finishReason) {
      lastFinishReason = candidate.finishReason;
    }

    // thought 파트 제외, 텍스트만 출력
    const parts = candidate?.content?.parts ?? [];
    for (const p of parts) {
      if (!p.thought && p.text) {
        yield { text: p.text };
      }
    }
  }

  // 스트림 종료 후 잘림 여부 전달
  if (lastFinishReason === "MAX_TOKENS") {
    yield { truncated: true };
  }
}

// ============================================================
// 구조화 데이터 추출 (JSON)
// ============================================================
export async function extract<T>(
  text: string,
  instruction: string
): Promise<T | null> {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text }] }],
      config: {
        systemInstruction:
          instruction + "\n\nJSON으로만 응답해. 다른 텍스트는 포함하지 마.",
        temperature: 0.1,
        maxOutputTokens: 1024,
        thinkingConfig: THINKING_CONFIG,
      },
    });

    // thought 파트 제외
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const content = parts
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join("");

    // JSON 추출
    const startBracket = content.indexOf("[");
    const startBrace = content.indexOf("{");
    let start = -1;
    let end = -1;

    if (startBracket >= 0 && (startBrace < 0 || startBracket < startBrace)) {
      start = startBracket;
      end = content.lastIndexOf("]") + 1;
    } else if (startBrace >= 0) {
      start = startBrace;
      end = content.lastIndexOf("}") + 1;
    }

    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end)) as T;
    }
  } catch {
    // extraction failed
  }
  return null;
}

// ============================================================
// 오디오 트랜스크립션 (Gemini 네이티브 — Whisper 대체)
// ============================================================
export async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const base64 = Buffer.from(audioBuffer).toString("base64");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: base64,
              mimeType,
            },
          },
          {
            text: "이 오디오를 한국어로 정확히 텍스트로 변환해 주세요. 말한 내용만 텍스트로 출력하고, 다른 설명은 추가하지 마세요.",
          },
        ],
      },
    ],
    config: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      thinkingConfig: THINKING_CONFIG,
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("");
}
