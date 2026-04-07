import { chat } from "@/lib/llm";
import { extractJudgmentPatterns } from "@/lib/judgment-extractor";
import type {
  ExtractionResult,
  QuestionIntent,
  JudgmentAxis,
  IfThenPattern,
  ExperienceStory,
} from "@/types";

export const DEEP_SEED_QUESTIONS = [
  "전문 분야가 무엇인가요? 그리고 이 분야에서 몇 년 정도 경력이 있으신가요?",
  "이 분야에서 가장 중요하다고 생각하는 것은 무엇인가요? 왜 그렇게 생각하시나요?",
];

export const MAX_DEEP_QUESTIONS = 30;
const SATURATION_WINDOW = 3;

export interface DeepInterviewContext {
  answers: { question: string; answer: string; intent?: string }[];
  axes: JudgmentAxis[];
  patterns: IfThenPattern[];
  stories: ExperienceStory[];
  saturation: number;
}

export interface NextQuestionResult {
  question: string;
  intent: QuestionIntent;
  targetAxis: string | null;
}

/**
 * 현재 인터뷰 컨텍스트를 기반으로 다음 질문을 동적 생성한다.
 */
export async function generateNextQuestion(
  ctx: DeepInterviewContext
): Promise<NextQuestionResult> {
  const frameworkSummary = buildFrameworkSummary(ctx);

  const systemPrompt = `당신은 전문가의 판단 프레임워크를 추출하기 위한 인터뷰어입니다.

목표: 전문가가 "어떻게 판단하는지"의 뿌리까지 파고들어, 구조화된 판단 프레임워크를 구축하는 것.

현재까지 추출된 판단 프레임워크:
${frameworkSummary}

현재까지의 인터뷰 진행 상황:
- 답변 수: ${ctx.answers.length}
- 추출된 판단 축: ${ctx.axes.length}개
- 추출된 If-Then 패턴: ${ctx.patterns.length}개
- 추출된 경험 스토리: ${ctx.stories.length}개
- 포화도: ${ctx.saturation}

다음 질문을 생성하세요. 다음 규칙을 따르세요:
1. 이미 충분히 탐색된 축은 건너뛰세요.
2. 가중치가 높은 축에 대해 더 깊이 파고드세요.
3. 질문 유형을 다양하게 사용하세요: why, how, what_if, discover_story, cross_validate
4. 전문가가 자연스럽게 답할 수 있는 질문으로 만드세요.
5. 한 번에 하나의 질문만 생성하세요.

JSON으로만 응답:
{"question": "질문 내용", "intent": "explore_why|explore_how|explore_what_if|discover_story|cross_validate|confirm", "target_axis": "관련 판단 축 이름 또는 null"}`;

  const recentQA = ctx.answers
    .slice(-5)
    .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
    .join("\n\n");

  const result = await chat(systemPrompt, [
    { role: "user", content: `최근 인터뷰 내용:\n${recentQA}\n\n다음 질문을 생성해주세요.` },
  ], { temperature: 0.7, maxTokens: 512 });

  try {
    const start = result.indexOf("{");
    const end = result.lastIndexOf("}") + 1;
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(result.slice(start, end));
      return {
        question: parsed.question ?? "이 분야에서 가장 어려웠던 경험은 무엇인가요?",
        intent: isValidIntent(parsed.intent) ? parsed.intent : "explore_why",
        targetAxis: parsed.target_axis ?? null,
      };
    }
  } catch {
    // fallback
  }

  return {
    question: "이 분야에서 가장 어려웠던 판단 경험은 무엇인가요?",
    intent: "discover_story",
    targetAxis: null,
  };
}

/**
 * 답변에서 판단 패턴을 추출한다.
 */
export async function extractFromAnswer(
  question: string,
  answer: string,
  existingAxesNames: string[]
): Promise<ExtractionResult> {
  const text = `질문: ${question}\n답변: ${answer}`;
  return extractJudgmentPatterns(text, existingAxesNames);
}

/**
 * 포화도를 계산한다.
 * 최근 N개 답변에서 새로운 축/패턴/스토리가 추출되지 않으면 포화.
 */
export function calculateSaturation(
  recentExtractions: ExtractionResult[],
  windowSize: number = SATURATION_WINDOW,
  totalAnswerCount: number = 0
): number {
  // 최소 5개 답변 전에는 포화로 판정하지 않음
  if (totalAnswerCount < 5) return 0;
  if (recentExtractions.length < windowSize) return 0;
  const recent = recentExtractions.slice(-windowSize);
  const newItemsCount = recent.reduce(
    (sum, e) =>
      sum + e.newAxes.length + e.newPatterns.length + e.newStories.length,
    0
  );
  if (newItemsCount === 0) return 1.0;
  if (newItemsCount <= 2) return 0.7;
  if (newItemsCount <= 5) return 0.3;
  return 0;
}

/**
 * 현재 인터뷰 phase를 판단한다.
 */
export function determinePhase(
  answerCount: number,
  saturation: number
): "seed" | "deep_dive" | "cross_validation" | "confirmation" {
  if (answerCount < DEEP_SEED_QUESTIONS.length) return "seed";
  if (saturation >= 0.7) {
    if (saturation >= 1.0) return "confirmation";
    return "cross_validation";
  }
  return "deep_dive";
}

function buildFrameworkSummary(ctx: DeepInterviewContext): string {
  const parts: string[] = [];
  if (ctx.axes.length > 0) {
    parts.push(
      "판단 축:\n" +
        ctx.axes.map((a) => `- ${a.name} (가중치: ${a.weight})`).join("\n")
    );
  }
  if (ctx.patterns.length > 0) {
    parts.push(
      "If-Then 패턴:\n" +
        ctx.patterns
          .slice(0, 10)
          .map((p) => `- IF ${p.condition} → THEN ${p.action}`)
          .join("\n")
    );
  }
  if (ctx.stories.length > 0) {
    parts.push(
      "경험 스토리:\n" +
        ctx.stories.map((s) => `- ${s.title}`).join("\n")
    );
  }
  return parts.length > 0 ? parts.join("\n\n") : "(아직 추출된 프레임워크 없음)";
}

function isValidIntent(intent: string): intent is QuestionIntent {
  return [
    "explore_why",
    "explore_how",
    "explore_what_if",
    "discover_story",
    "cross_validate",
    "confirm",
  ].includes(intent);
}
