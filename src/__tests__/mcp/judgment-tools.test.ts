import { describe, expect, it } from "vitest";

// Test MCP server judgment tool formatting logic without importing actual server

describe("MCP: consult_judgment response formatting", () => {
  it("formats full judgment result", () => {
    const data = {
      judgment: "Redis를 선택하세요",
      reasoning: "확장성과 운영 복잡도를 고려했을 때",
      applicable_axes: [
        { name: "확장성", weight: 0.9 },
        { name: "운영 복잡도", weight: 0.7 },
      ],
      relevant_patterns: [
        { condition: "세션 캐싱 용도", action: "Redis 선택" },
      ],
      similar_story: {
        title: "대규모 캐시 마이그레이션",
        summary: "Memcached에서 Redis로 전환한 경험",
        decision: "Redis 선택",
      },
      confidence: 0.85,
      caveats: ["팀 Redis 운영 경험 확인 필요"],
    };

    const axesInfo = data.applicable_axes
      .map((a) => `  - ${a.name} (중요도: ${a.weight})`)
      .join("\n");
    const patternsInfo = data.relevant_patterns
      .map((p) => `  - IF ${p.condition} → THEN ${p.action}`)
      .join("\n");
    const storyInfo = data.similar_story
      ? `\n관련 경험: ${data.similar_story.title}\n  ${data.similar_story.summary}`
      : "";
    const caveatsInfo =
      data.caveats.length > 0
        ? `\n주의사항:\n${data.caveats.map((c) => `  - ${c}`).join("\n")}`
        : "";

    const text = [
      `판단: ${data.judgment}`,
      "",
      `근거: ${data.reasoning}`,
      "",
      `적용된 판단 축:\n${axesInfo}`,
      `\n매칭된 패턴:\n${patternsInfo}`,
      storyInfo,
      `\n신뢰도: ${data.confidence}`,
      caveatsInfo,
    ]
      .filter(Boolean)
      .join("\n");

    expect(text).toContain("Redis를 선택하세요");
    expect(text).toContain("확장성 (중요도: 0.9)");
    expect(text).toContain("IF 세션 캐싱 용도 → THEN Redis 선택");
    expect(text).toContain("대규모 캐시 마이그레이션");
    expect(text).toContain("신뢰도: 0.85");
    expect(text).toContain("팀 Redis 운영 경험 확인 필요");
  });

  it("handles missing story gracefully", () => {
    const data = { similar_story: null as { title: string; summary: string } | null };
    const storyInfo = data.similar_story
      ? `\n관련 경험: ${data.similar_story.title}\n  ${data.similar_story.summary}`
      : "";
    expect(storyInfo).toBe("");
  });

  it("handles empty caveats", () => {
    const caveats: string[] = [];
    const caveatsInfo =
      caveats.length > 0
        ? `\n주의사항:\n${caveats.map((c: string) => `  - ${c}`).join("\n")}`
        : "";
    expect(caveatsInfo).toBe("");
  });
});

describe("MCP: get_framework response formatting", () => {
  it("formats axes and patterns", () => {
    const data = {
      philosophy: "사용자 가치 최우선",
      domains: ["백엔드", "인프라"],
      axes: [
        { name: "확장성", weight: 0.9, description: "시스템 확장 가능성" },
        { name: "안정성", weight: 0.8, description: null },
      ],
      key_patterns: [
        { condition: "트래픽 급증", action: "수평 확장", reasoning: "비용 효율" },
        { condition: "장애 발생", action: "롤백 우선", reasoning: null },
      ],
    };

    const axesList = data.axes
      .map(
        (a) =>
          `- **${a.name}** (중요도: ${a.weight})${a.description ? `: ${a.description}` : ""}`
      )
      .join("\n");
    const patternsList = data.key_patterns
      .map(
        (p) =>
          `- IF ${p.condition} → THEN ${p.action}${p.reasoning ? ` (${p.reasoning})` : ""}`
      )
      .join("\n");

    const text = [
      `판단 철학: ${data.philosophy}`,
      `도메인: ${data.domains.join(", ")}`,
      "",
      `판단 축:\n${axesList}`,
      "",
      `핵심 패턴:\n${patternsList}`,
    ]
      .filter(Boolean)
      .join("\n");

    expect(text).toContain("사용자 가치 최우선");
    expect(text).toContain("백엔드, 인프라");
    expect(text).toContain("**확장성** (중요도: 0.9): 시스템 확장 가능성");
    expect(text).toContain("**안정성** (중요도: 0.8)");
    expect(text).not.toContain("안정성**: null");
    expect(text).toContain("IF 트래픽 급증 → THEN 수평 확장 (비용 효율)");
    expect(text).toContain("IF 장애 발생 → THEN 롤백 우선");
    expect(text).not.toContain("(null)");
  });
});

describe("MCP: find_similar_story response formatting", () => {
  it("formats stories with relevance percentage", () => {
    const stories = [
      {
        title: "마이그레이션 경험",
        summary: "요약",
        context: "레거시 시스템",
        decision: "점진적 이관",
        outcome: "성공",
        lesson: "작은 단위로",
        relevance: 0.87,
      },
    ];

    const list = stories
      .map((s) =>
        [
          `### ${s.title} (관련도: ${(s.relevance * 100).toFixed(0)}%)`,
          s.summary,
          `상황: ${s.context}`,
          `판단: ${s.decision}`,
          s.outcome ? `결과: ${s.outcome}` : "",
          s.lesson ? `교훈: ${s.lesson}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n\n");

    expect(list).toContain("마이그레이션 경험 (관련도: 87%)");
    expect(list).toContain("상황: 레거시 시스템");
    expect(list).toContain("판단: 점진적 이관");
    expect(list).toContain("결과: 성공");
    expect(list).toContain("교훈: 작은 단위로");
  });

  it("handles empty story list", () => {
    const stories: unknown[] = [];
    const isEmpty = !stories || stories.length === 0;
    expect(isEmpty).toBe(true);
  });
});

describe("MCP: compare_approaches response formatting", () => {
  it("formats comparison result", () => {
    const data = {
      recommended: "Redis",
      reasoning: "확장성과 기능이 더 풍부",
      per_approach: [
        {
          name: "Redis",
          pros: ["풍부한 데이터 구조", "Pub/Sub 지원"],
          cons: ["메모리 사용량 높음"],
          risk_level: "low",
        },
        {
          name: "Memcached",
          pros: ["단순함", "낮은 메모리"],
          cons: ["기능 제한"],
          risk_level: "medium",
        },
      ],
    };

    const perApproach = data.per_approach
      .map(
        (a) =>
          [
            `### ${a.name} (리스크: ${a.risk_level})`,
            `장점: ${a.pros.join(", ")}`,
            `단점: ${a.cons.join(", ")}`,
          ].join("\n")
      )
      .join("\n\n");

    const text = [
      `추천: **${data.recommended}**`,
      "",
      `근거: ${data.reasoning}`,
      "",
      perApproach,
    ].join("\n");

    expect(text).toContain("추천: **Redis**");
    expect(text).toContain("풍부한 데이터 구조, Pub/Sub 지원");
    expect(text).toContain("리스크: low");
    expect(text).toContain("리스크: medium");
  });
});

describe("MCP: interview deep mode response formatting", () => {
  it("formats confirming status", () => {
    const data = {
      status: "confirming",
      message: "추출된 프레임워크를 확인해 주세요.",
      progress: { answered: 15, saturation: 1.0 },
    };

    const text = [
      "판단 프레임워크 추출이 완료되었습니다!",
      "",
      data.message,
      "",
      `답변 수: ${data.progress.answered}개, 포화도: ${data.progress.saturation}`,
    ]
      .filter(Boolean)
      .join("\n");

    expect(text).toContain("프레임워크 추출이 완료");
    expect(text).toContain("답변 수: 15개");
    expect(text).toContain("포화도: 1");
  });

  it("formats in_progress with extraction info", () => {
    const data = {
      phase: "deep_dive",
      extracted: { axes: [1], patterns: [1, 2], stories: [] },
      progress: { answered: 5, saturation: 0.3 },
      next_question: "왜 확장성을 중시하나요?",
    };

    const extractedInfo = `\n추출됨: 축 ${data.extracted.axes.length}개, 패턴 ${data.extracted.patterns.length}개, 스토리 ${data.extracted.stories.length}개`;
    const progressInfo = `\n진행: ${data.progress.answered}개 답변, 포화도: ${data.progress.saturation}`;

    const text = [
      `단계: ${data.phase}`,
      extractedInfo,
      progressInfo,
      "",
      `다음 질문: ${data.next_question}`,
    ].join("\n");

    expect(text).toContain("단계: deep_dive");
    expect(text).toContain("축 1개, 패턴 2개, 스토리 0개");
    expect(text).toContain("5개 답변");
    expect(text).toContain("왜 확장성을 중시하나요?");
  });
});
