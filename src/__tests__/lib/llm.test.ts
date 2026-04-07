import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock GoogleGenAI before importing
const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();

vi.mock("@/lib/gemini-pool", () => ({
  getGeminiClient: () => ({
    models: {
      generateContent: mockGenerateContent,
      generateContentStream: mockGenerateContentStream,
    },
  }),
}));

// Import after mocking
const { chat, streamChat, extract, transcribeAudio } = await import("@/lib/llm");

describe("chat", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it("returns text content, filtering out thought parts", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: "internal thinking..." },
              { text: "Hello! " },
              { text: "How can I help?" },
            ],
          },
        },
      ],
    });

    const result = await chat("system prompt", [
      { role: "user", content: "hi" },
    ]);
    expect(result).toBe("Hello! How can I help?");
  });

  it("returns empty string when no candidates", async () => {
    mockGenerateContent.mockResolvedValue({ candidates: [] });
    const result = await chat("sys", [{ role: "user", content: "hi" }]);
    expect(result).toBe("");
  });

  it("maps assistant role to model role", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
    });

    await chat("sys", [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ]);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents[0].role).toBe("user");
    expect(callArgs.contents[1].role).toBe("model");
    expect(callArgs.contents[2].role).toBe("user");
  });

  it("passes system prompt and options correctly", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
    });

    await chat("my system prompt", [{ role: "user", content: "hi" }], {
      temperature: 0.5,
      maxTokens: 2048,
    });

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.systemInstruction).toBe("my system prompt");
    expect(callArgs.config.temperature).toBe(0.5);
    expect(callArgs.config.maxOutputTokens).toBe(2048);
  });

  it("uses default temperature 0.7 and maxTokens 4096", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
    });

    await chat("sys", [{ role: "user", content: "hi" }]);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.temperature).toBe(0.7);
    expect(callArgs.config.maxOutputTokens).toBe(4096);
  });
});

describe("streamChat", () => {
  beforeEach(() => {
    mockGenerateContentStream.mockReset();
  });

  it("yields text chunks, filtering thoughts", async () => {
    const chunks = [
      {
        candidates: [
          { content: { parts: [{ thought: true, text: "thinking" }] } },
        ],
      },
      {
        candidates: [
          { content: { parts: [{ text: "Hello " }] } },
        ],
      },
      {
        candidates: [
          { content: { parts: [{ text: "world" }] }, finishReason: "STOP" },
        ],
      },
    ];

    mockGenerateContentStream.mockResolvedValue(
      (async function* () {
        for (const c of chunks) yield c;
      })()
    );

    const results: { text?: string; truncated?: boolean }[] = [];
    for await (const chunk of streamChat("sys", [
      { role: "user", content: "hi" },
    ])) {
      results.push(chunk);
    }

    expect(results).toEqual([{ text: "Hello " }, { text: "world" }]);
  });

  it("yields truncated flag on MAX_TOKENS", async () => {
    const chunks = [
      {
        candidates: [
          { content: { parts: [{ text: "partial" }] }, finishReason: "MAX_TOKENS" },
        ],
      },
    ];

    mockGenerateContentStream.mockResolvedValue(
      (async function* () {
        for (const c of chunks) yield c;
      })()
    );

    const results: { text?: string; truncated?: boolean }[] = [];
    for await (const chunk of streamChat("sys", [
      { role: "user", content: "hi" },
    ])) {
      results.push(chunk);
    }

    expect(results).toEqual([{ text: "partial" }, { truncated: true }]);
  });

  it("does not yield truncated flag on normal finish", async () => {
    const chunks = [
      {
        candidates: [
          { content: { parts: [{ text: "done" }] }, finishReason: "STOP" },
        ],
      },
    ];

    mockGenerateContentStream.mockResolvedValue(
      (async function* () {
        for (const c of chunks) yield c;
      })()
    );

    const results: { text?: string; truncated?: boolean }[] = [];
    for await (const chunk of streamChat("sys", [
      { role: "user", content: "hi" },
    ])) {
      results.push(chunk);
    }

    expect(results).toEqual([{ text: "done" }]);
  });
});

describe("extract", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it("extracts JSON object from response", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { text: '여기 결과입니다: {"name": "test", "value": 42}' },
            ],
          },
        },
      ],
    });

    const result = await extract<{ name: string; value: number }>(
      "input text",
      "extract instruction"
    );
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("extracts JSON array from response", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: '["원칙1", "원칙2", "원칙3"]' }],
          },
        },
      ],
    });

    const result = await extract<string[]>("input", "instruction");
    expect(result).toEqual(["원칙1", "원칙2", "원칙3"]);
  });

  it("returns null when no JSON found", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: "no json here at all" }],
          },
        },
      ],
    });

    const result = await extract("input", "instruction");
    expect(result).toBeNull();
  });

  it("returns null on error", async () => {
    mockGenerateContent.mockRejectedValue(new Error("API Error"));
    const result = await extract("input", "instruction");
    expect(result).toBeNull();
  });

  it("filters out thought parts", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: '{"wrong": true}' },
              { text: '{"correct": true}' },
            ],
          },
        },
      ],
    });

    const result = await extract<{ correct: boolean }>("input", "instruction");
    expect(result).toEqual({ correct: true });
  });

  it("uses low temperature (0.1) for extraction", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "{}" }] } }],
    });

    await extract("input", "instruction");
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.temperature).toBe(0.1);
  });
});

describe("transcribeAudio", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it("sends base64 audio and returns transcription", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: "안녕하세요, 테스트 음성입니다." }],
          },
        },
      ],
    });

    const buffer = new ArrayBuffer(8);
    const result = await transcribeAudio(buffer, "audio/mpeg");
    expect(result).toBe("안녕하세요, 테스트 음성입니다.");
  });

  it("sends correct mime type", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "text" }] } }],
    });

    await transcribeAudio(new ArrayBuffer(4), "audio/wav");
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const inlineData = callArgs.contents[0].parts[0].inlineData;
    expect(inlineData.mimeType).toBe("audio/wav");
  });

  it("uses low temperature for transcription", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "" }] } }],
    });

    await transcribeAudio(new ArrayBuffer(4), "audio/mpeg");
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.config.temperature).toBe(0.1);
  });

  it("filters thought parts from transcription", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: "processing audio..." },
              { text: "실제 트랜스크립트" },
            ],
          },
        },
      ],
    });

    const result = await transcribeAudio(new ArrayBuffer(4), "audio/mpeg");
    expect(result).toBe("실제 트랜스크립트");
  });
});
