/**
 * 인터뷰 단계 및 질문 정의
 * (기존 Python questions.py의 INTERVIEW_PHASES 포트)
 */

export interface InterviewPhase {
  name: string;
  questions: string[];
}

export const INTERVIEW_PHASES: InterviewPhase[] = [
  {
    name: "domain",
    questions: [
      "전문 분야가 무엇인가요? 그리고 이 분야에서 몇 년 정도 경력이 있으신가요?",
      "이 분야에서 본인만의 강점이나 특기가 있다면 무엇인가요?",
    ],
  },
  {
    name: "principles",
    questions: [
      "업무에서 가장 중요하게 생각하는 원칙 3가지는 무엇인가요?",
      "후배에게 꼭 강조하는 조언이 있다면 무엇인가요?",
      "이 분야에서 흔히 하는 실수는 무엇이고, 어떻게 피할 수 있나요?",
    ],
  },
  {
    name: "scenarios",
    questions: [
      "가장 어려웠던 의사결정 상황은 무엇이었나요? 어떻게 판단하셨나요?",
      "예산이나 시간이 부족할 때 우선순위를 어떻게 정하시나요?",
      "고객/의뢰인의 요청이 본인의 전문적 판단과 충돌할 때 어떻게 하시나요?",
    ],
  },
  {
    name: "style",
    questions: [
      "평소 설명하실 때 어떤 방식을 선호하시나요? (비유, 데이터, 사례, 직설적 등)",
    ],
  },
];

export function getTotalQuestions(): number {
  return INTERVIEW_PHASES.reduce((sum, p) => sum + p.questions.length, 0);
}

export function getQuestion(
  phaseIndex: number,
  questionIndex: number
): string | null {
  if (phaseIndex >= INTERVIEW_PHASES.length) return null;
  const phase = INTERVIEW_PHASES[phaseIndex];
  if (questionIndex >= phase.questions.length) return null;
  return phase.questions[questionIndex];
}

/**
 * Deep 모드용 초기 seed 질문.
 * deep 모드에서는 이 질문 이후 LLM이 동적으로 질문을 생성한다.
 */
export const DEEP_SEED_QUESTIONS: string[] = [
  "전문 분야가 무엇인가요? 그리고 이 분야에서 몇 년 정도 경력이 있으신가요?",
  "이 분야에서 가장 중요하다고 생각하는 것은 무엇인가요? 왜 그렇게 생각하시나요?",
];

export function getNextPosition(
  phaseIndex: number,
  questionIndex: number
): { phaseIndex: number; questionIndex: number } | null {
  const nextQ = questionIndex + 1;
  if (phaseIndex < INTERVIEW_PHASES.length) {
    if (nextQ < INTERVIEW_PHASES[phaseIndex].questions.length) {
      return { phaseIndex, questionIndex: nextQ };
    }
    // 다음 단계로
    const nextP = phaseIndex + 1;
    if (nextP < INTERVIEW_PHASES.length) {
      return { phaseIndex: nextP, questionIndex: 0 };
    }
  }
  return null; // 완료
}
