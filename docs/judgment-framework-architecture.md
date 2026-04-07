# 판단 프레임워크 아카이빙 — 기술 설계서

> 기획서(`judgment-framework-spec.md`) 기반 아키텍처 설계
> 
> 작성일: 2026-04-07

---

## 1. DB 스키마 변경

### 1.1 신규 테이블

기획서 4절의 데이터 모델을 그대로 반영한다. 아래는 마이그레이션 SQL 초안이다.

### 1.2 마이그레이션 SQL: `003_judgment_framework.sql`

```sql
-- ============================================================
-- 003_judgment_framework.sql
-- 판단 프레임워크 아카이빙 신규 테이블 + 기존 테이블 확장
-- ============================================================

-- ============================================================
-- 1. 신규 테이블
-- ============================================================

-- 판단 프레임워크 (페르소나당 1개)
create table judgment_frameworks (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null unique references personas(id) on delete cascade,
  philosophy text,
  domains text[] default '{}',
  version int default 1,
  status text default 'building'
    check (status in ('building', 'ready', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger judgment_frameworks_updated_at
  before update on judgment_frameworks
  for each row execute procedure update_updated_at();

-- 판단 축
create table judgment_axes (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references judgment_frameworks(id) on delete cascade,
  name text not null,
  description text,
  weight numeric(3,2) default 0.5
    check (weight >= 0 and weight <= 1),
  domain text,
  evidence_count int default 0,
  created_at timestamptz default now()
);

create index judgment_axes_framework_idx on judgment_axes(framework_id);

-- If-Then 판단 패턴
create table if_then_patterns (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references judgment_frameworks(id) on delete cascade,
  condition text not null,
  action text not null,
  reasoning text,
  axis_id uuid references judgment_axes(id) on delete set null,
  confidence numeric(3,2) default 0.5
    check (confidence >= 0 and confidence <= 1),
  source_type text not null
    check (source_type in ('interview', 'audio', 'manual')),
  source_id uuid,
  created_at timestamptz default now()
);

create index if_then_patterns_framework_idx on if_then_patterns(framework_id);
create index if_then_patterns_axis_idx on if_then_patterns(axis_id);

-- 경험 스토리
create table experience_stories (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references judgment_frameworks(id) on delete cascade,
  title text not null,
  summary text not null,
  context text not null,
  decision text not null,
  outcome text,
  lesson text,
  related_axes uuid[] default '{}',
  embedding vector(768),
  source_type text not null
    check (source_type in ('interview', 'audio', 'manual')),
  source_id uuid,
  created_at timestamptz default now()
);

create index stories_embedding_idx on experience_stories
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index stories_framework_idx on experience_stories(framework_id);

-- ============================================================
-- 2. 기존 테이블 확장
-- ============================================================

-- personas: 프레임워크 연결 참조
alter table personas add column framework_id uuid references judgment_frameworks(id);

-- interview_sessions: 심층 인터뷰 지원
alter table interview_sessions add column mode text default 'classic'
  check (mode in ('classic', 'deep'));
alter table interview_sessions add column total_questions int default 0;
alter table interview_sessions add column saturation_score numeric(3,2) default 0;

-- interview_answers: 추출 결과 저장
alter table interview_answers add column extracted_axes jsonb default '[]';
alter table interview_answers add column extracted_patterns jsonb default '[]';
alter table interview_answers add column extracted_stories jsonb default '[]';
alter table interview_answers add column question_intent text;

-- ============================================================
-- 3. RPC 함수
-- ============================================================

-- 경험 스토리 유사도 검색
create or replace function match_stories(
  query_embedding vector(768),
  target_framework_id uuid,
  match_count int default 5
) returns table (
  id uuid,
  title text,
  summary text,
  context text,
  decision text,
  outcome text,
  lesson text,
  related_axes uuid[],
  similarity float
)
language plpgsql as $$
begin
  return query
    select
      es.id, es.title, es.summary, es.context,
      es.decision, es.outcome, es.lesson, es.related_axes,
      1 - (es.embedding <=> query_embedding) as similarity
    from experience_stories es
    where es.framework_id = target_framework_id
      and es.embedding is not null
    order by es.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- 품질 게이트 v2 (기존 v1 하위 호환)
create or replace function check_quality_gate_v2(target_persona_id uuid)
returns jsonb
language plpgsql security definer as $$
declare
  result jsonb;
  v_framework_id uuid;
  v_axes_count int;
  v_patterns_count int;
  v_stories_count int;
  v_deep_interview boolean;
  v_must_pass boolean;
  v_interview_complete boolean;
  v_chunks_count int;
  v_principles_count int;
  v_scenarios_count int;
begin
  -- 프레임워크 존재 확인
  select jf.id into v_framework_id
  from judgment_frameworks jf
  where jf.persona_id = target_persona_id and jf.status = 'ready';

  -- 프레임워크 없으면 기존 v1 로직
  if v_framework_id is null then
    select exists(
      select 1 from interview_sessions
      where persona_id = target_persona_id and completed = true
    ) into v_interview_complete;

    select count(*) into v_chunks_count
    from chunks where persona_id = target_persona_id;

    select coalesce(array_length(principles, 1), 0) into v_principles_count
    from personas where id = target_persona_id;

    select coalesce(jsonb_array_length(decision_scenarios), 0) into v_scenarios_count
    from personas where id = target_persona_id;

    return jsonb_build_object(
      'version', 1,
      'interview_complete', v_interview_complete,
      'chunks_count', v_chunks_count,
      'principles_count', v_principles_count,
      'scenarios_count', v_scenarios_count,
      'eligible', v_interview_complete and v_chunks_count >= 1
    );
  end if;

  -- 새 품질 게이트
  select count(*) into v_axes_count
  from judgment_axes where framework_id = v_framework_id;

  select count(*) into v_patterns_count
  from if_then_patterns where framework_id = v_framework_id;

  select count(*) into v_stories_count
  from experience_stories where framework_id = v_framework_id;

  select exists(
    select 1 from interview_sessions
    where persona_id = target_persona_id and mode = 'deep' and completed = true
  ) into v_deep_interview;

  v_must_pass := v_deep_interview
    and v_axes_count >= 3
    and v_patterns_count >= 8
    and v_stories_count >= 5;

  result := jsonb_build_object(
    'version', 2,
    'framework_id', v_framework_id,
    'deep_interview_complete', v_deep_interview,
    'axes_count', v_axes_count,
    'patterns_count', v_patterns_count,
    'stories_count', v_stories_count,
    'must_pass', v_must_pass
  );

  return result;
end;
$$;

-- ============================================================
-- 4. RLS 정책
-- ============================================================

alter table judgment_frameworks enable row level security;
alter table judgment_axes enable row level security;
alter table if_then_patterns enable row level security;
alter table experience_stories enable row level security;

-- 소유자 접근
create policy "Users can manage own frameworks" on judgment_frameworks for all
  using (persona_id in (select id from personas where user_id = auth.uid()));

create policy "Users can manage own axes" on judgment_axes for all
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join personas p on jf.persona_id = p.id
    where p.user_id = auth.uid()
  ));

create policy "Users can manage own patterns" on if_then_patterns for all
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join personas p on jf.persona_id = p.id
    where p.user_id = auth.uid()
  ));

create policy "Users can manage own stories" on experience_stories for all
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join personas p on jf.persona_id = p.id
    where p.user_id = auth.uid()
  ));

-- 구매자 읽기 접근
create policy "Buyers can read purchased frameworks" on judgment_frameworks for select
  using (persona_id in (
    select pu.persona_id from purchases pu
    where pu.buyer_id = auth.uid() and pu.status = 'confirmed'
  ));

create policy "Buyers can read purchased axes" on judgment_axes for select
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join purchases pu on jf.persona_id = pu.persona_id
    where pu.buyer_id = auth.uid() and pu.status = 'confirmed'
  ));

create policy "Buyers can read purchased patterns" on if_then_patterns for select
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join purchases pu on jf.persona_id = pu.persona_id
    where pu.buyer_id = auth.uid() and pu.status = 'confirmed'
  ));

create policy "Buyers can read purchased stories" on experience_stories for select
  using (framework_id in (
    select jf.id from judgment_frameworks jf
    join purchases pu on jf.persona_id = pu.persona_id
    where pu.buyer_id = auth.uid() and pu.status = 'confirmed'
  ));

-- 서비스 역할 전체 접근 (추출 엔진 등에서 사용)
create policy "Service can manage frameworks" on judgment_frameworks for all
  using (true) with check (true);
create policy "Service can manage axes" on judgment_axes for all
  using (true) with check (true);
create policy "Service can manage patterns" on if_then_patterns for all
  using (true) with check (true);
create policy "Service can manage stories" on experience_stories for all
  using (true) with check (true);
```

---

## 2. API 엔드포인트 설계

### 2.1 심층 인터뷰 API

기존 인터뷰 API를 확장한다. `mode` 파라미터로 classic/deep을 구분한다.

#### `POST /api/interview/[personaId]/start`

기존 route 수정. `mode` 파라미터 추가.

```typescript
// 요청 body
{ mode?: "classic" | "deep" }  // 기본값: "deep"

// 응답 (deep 모드)
{
  session_id: string,
  mode: "deep",
  phase: "seed",
  question: string,              // LLM이 생성한 첫 번째 질문
  question_intent: "explore_why",
  progress: { answered: 0, estimated_remaining: 15 }
}
```

#### `POST /api/interview/[personaId]/answer`

기존 route 수정. deep 모드일 때 동적 질문 생성 + 패턴 추출을 수행한다.

```typescript
// 요청 body
{ session_id: string, answer: string }

// 응답 (deep 모드, 진행 중)
{
  status: "in_progress",
  phase: "deep_dive" | "cross_validation" | "confirmation",
  next_question: string,
  question_intent: QuestionIntent,
  extracted: {                   // 이 답변에서 추출된 패턴 (실시간 피드백)
    axes: JudgmentAxis[],
    patterns: IfThenPattern[],
    stories: ExperienceStory[]
  },
  progress: { answered: 5, estimated_remaining: 12, saturation: 0.35 }
}

// 응답 (deep 모드, confirmation phase)
{
  status: "confirming",
  framework_summary: {
    axes: JudgmentAxis[],
    patterns: IfThenPattern[],
    stories: ExperienceStory[],
    philosophy: string
  },
  message: "추출된 판단 프레임워크를 확인해 주세요. 수정할 부분이 있나요?"
}

// 응답 (완료)
{
  status: "completed",
  framework_id: string
}
```

내부 동작 (deep 모드):
1. 답변을 `interview_answers`에 저장 (기존과 동일)
2. LLM `extract<T>`로 답변에서 판단 패턴 추출 → DB에 저장
3. 현재까지의 모든 답변 + 추출 패턴을 기반으로 LLM이 다음 질문 생성
4. 포화도(saturation) 계산: 최근 3개 답변에서 새로운 축/패턴이 추출되지 않으면 포화 판정
5. 포화 시 cross-validation phase로 전환, 이후 confirmation phase

#### `POST /api/interview/[personaId]/confirm`

**신규 route.** confirmation phase에서 전문가가 프레임워크를 확인/수정한다.

```typescript
// 요청 body
{
  session_id: string,
  confirmed: boolean,
  edits?: {
    axes?: { id: string, weight?: number, description?: string }[],
    patterns?: { id: string, action?: string, reasoning?: string }[],
    remove_axes?: string[],
    remove_patterns?: string[],
    remove_stories?: string[]
  }
}

// 응답
{
  status: "completed",
  framework_id: string,
  framework_status: "ready"
}
```

### 2.2 판단 프레임워크 조회/수정 API

#### `GET /api/personas/[id]/framework`

**신규 route.** 페르소나의 판단 프레임워크를 조회한다.

```typescript
// 응답
{
  framework: JudgmentFramework,
  axes: JudgmentAxis[],
  patterns: IfThenPattern[],
  stories: ExperienceStory[],   // embedding 필드 제외
  quality: {                    // check_quality_gate_v2 결과
    version: 2,
    axes_count: number,
    patterns_count: number,
    stories_count: number,
    must_pass: boolean
  }
}
```

#### `PATCH /api/personas/[id]/framework`

**신규 route.** 프레임워크를 수정한다 (소유자 전용).

```typescript
// 요청 body
{
  philosophy?: string,
  domains?: string[],
  axes?: { id?: string, name: string, weight: number, description?: string }[],
  patterns?: { id?: string, condition: string, action: string, reasoning?: string }[],
  // id가 없으면 신규 생성, 있으면 수정
}
```

### 2.3 판단 자문 API (external)

MCP 서버가 호출하는 API 키 인증 엔드포인트.

#### `POST /api/external/consult`

**신규 route.**

```typescript
// 요청 body
{
  persona_id: string,
  situation: string,
  context?: Record<string, unknown>,
  constraints?: string[]
}

// 응답
{
  judgment: string,
  reasoning: string,
  applicable_axes: { name: string, weight: number }[],
  relevant_patterns: { condition: string, action: string }[],
  similar_story?: { title: string, summary: string, decision: string },
  confidence: number,
  caveats: string[]
}
```

내부 동작:
1. API 키 검증 (기존 패턴 동일)
2. 페르소나 + 프레임워크(axes, patterns) 조회
3. `situation`을 임베딩하여 관련 청크(RAG) + 경험 스토리 검색
4. `buildSystemPrompt` (프레임워크 포함 버전)으로 시스템 프롬프트 구성
5. LLM에 구조화된 판단 요청 → `extract<T>`로 JSON 응답 파싱
6. 결과 반환

#### `GET /api/external/framework`

**신규 route.**

```typescript
// 쿼리 파라미터
persona_id: string
domain?: string

// 응답
{
  axes: JudgmentAxis[],
  key_patterns: IfThenPattern[],    // 상위 10개
  philosophy: string,
  domains: string[]
}
```

#### `POST /api/external/stories`

**신규 route.**

```typescript
// 요청 body
{ persona_id: string, query: string }

// 응답
{
  stories: Array<{
    title: string, summary: string, context: string,
    decision: string, outcome: string, lesson: string,
    relevance: number
  }>
}
```

#### `POST /api/external/compare`

**신규 route.**

```typescript
// 요청 body
{
  persona_id: string,
  approaches: string[],
  context?: string
}

// 응답
{
  recommended: string,
  reasoning: string,
  per_approach: Array<{
    name: string, pros: string[], cons: string[],
    axes_alignment: Record<string, number>,
    risk_level: "low" | "medium" | "high"
  }>,
  relevant_stories: Array<{ title: string, summary: string }>
}
```

---

## 3. MCP 도구 설계

기존 8개 도구를 모두 유지하고, 4개 신규 도구를 추가한다.

### 3.1 기존 도구 변경 사항

| 도구 | 변경 |
|------|------|
| `chat` | 변경 없음 (서버 쪽 `buildSystemPrompt`가 프레임워크를 포함) |
| `persona_list` | 응답에 `framework_status` 필드 추가 |
| `persona_create` | 내부적으로 `judgment_frameworks` 자동 생성 |
| `interview` | `mode` 파라미터 추가 (기본값 `deep`) |
| `upload_audio` | 변경 없음 (서버 쪽에서 추출 파이프라인 자동 실행) |
| `store_search` | 변경 없음 |
| `store_preview` | 변경 없음 |
| `my_purchased_personas` | 변경 없음 |

### 3.2 신규 도구

#### `consult_judgment`

```typescript
server.tool(
  "consult_judgment",
  "전문가의 판단 프레임워크에 기반한 구조화된 판단 자문을 받습니다. " +
  "단순 chat과 달리 판단 축, If-Then 패턴, 경험 스토리를 기반으로 " +
  "근거 있는 판단과 신뢰도를 제공합니다.",
  {
    persona_id: z.string().describe("페르소나 ID"),
    situation: z.string().describe("판단이 필요한 상황 설명"),
    context: z.record(z.unknown()).optional()
      .describe("추가 컨텍스트 (예: { expected_tps: 500, team_size: 4 })"),
    constraints: z.array(z.string()).optional()
      .describe("제약 조건 목록"),
  },
  // → POST /api/external/consult
);
```

#### `get_framework`

```typescript
server.tool(
  "get_framework",
  "전문가의 판단 프레임워크(판단 축, 핵심 패턴, 판단 철학)를 조회합니다.",
  {
    persona_id: z.string().describe("페르소나 ID"),
    domain: z.string().optional()
      .describe("특정 도메인 필터 (예: '시스템 설계')"),
  },
  // → GET /api/external/framework?persona_id=...&domain=...
);
```

#### `find_similar_story`

```typescript
server.tool(
  "find_similar_story",
  "전문가의 과거 경험 중 현재 상황과 유사한 스토리를 검색합니다. " +
  "경험에서 나온 교훈과 판단을 참고할 수 있습니다.",
  {
    persona_id: z.string().describe("페르소나 ID"),
    query: z.string().describe("검색할 상황이나 키워드"),
  },
  // → POST /api/external/stories
);
```

#### `compare_approaches`

```typescript
server.tool(
  "compare_approaches",
  "여러 접근법을 전문가의 판단 프레임워크 기반으로 비교 분석합니다. " +
  "각 접근법의 장단점과 판단 축 부합도를 제공합니다.",
  {
    persona_id: z.string().describe("페르소나 ID"),
    approaches: z.array(z.string()).min(2).max(5)
      .describe("비교할 접근법 목록 (2~5개)"),
    context: z.string().optional()
      .describe("비교 상황 설명 (예: '세션 캐싱 용도, 일 100만 요청')"),
  },
  // → POST /api/external/compare
);
```

---

## 4. 프롬프트 엔지니어링

### 4.1 `buildSystemPrompt` 개편

기존 함수 시그니처를 확장하되, 프레임워크가 없는 경우 기존 로직 그대로 동작한다.

**파일: `src/lib/prompt.ts`**

```typescript
import type { Persona, JudgmentFramework, JudgmentAxis, IfThenPattern } from "@/types";

interface FrameworkData {
  framework: JudgmentFramework;
  axes: JudgmentAxis[];
  patterns: IfThenPattern[];
}

export function buildSystemPrompt(
  persona: Persona,
  context: string,
  frameworkData?: FrameworkData
): string {
  const sections: string[] = [];

  // 기본 정체성 (기존과 동일)
  const domainStr = persona.domain ? ` (${persona.domain} 분야 전문가)` : "";
  sections.push(
    `당신은 '${persona.name}'입니다.${domainStr}\n${persona.description ?? ""}`
  );

  // === 프레임워크 있는 경우: 새 섹션 추가 ===
  if (frameworkData) {
    const { framework, axes, patterns } = frameworkData;

    // 판단 철학
    if (framework.philosophy) {
      sections.push(`## 판단 철학\n${framework.philosophy}`);
    }

    // 판단 축 (가중치 포함)
    if (axes.length > 0) {
      const axesText = axes
        .sort((a, b) => b.weight - a.weight)
        .map(a => `- **${a.name}** (중요도: ${a.weight}): ${a.description ?? ""}`)
        .join("\n");
      sections.push(`## 판단 축 (의사결정 시 고려하는 기준)\n${axesText}`);
    }

    // If-Then 패턴
    if (patterns.length > 0) {
      const patternsText = patterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 15)  // 프롬프트 길이 제한: 상위 15개
        .map(p => {
          const reasoning = p.reasoning ? ` (근거: ${p.reasoning})` : "";
          return `- IF ${p.condition} → THEN ${p.action}${reasoning}`;
        })
        .join("\n");
      sections.push(`## 핵심 판단 패턴\n${patternsText}`);
    }
  }

  // === 프레임워크 없는 경우: 기존 로직 유지 ===
  if (!frameworkData) {
    if (persona.principles?.length > 0) {
      const principlesText = persona.principles
        .map((p, i) => `${i + 1}. ${p}`)
        .join("\n");
      sections.push(`## 핵심 판단 원칙\n${principlesText}`);
    }

    if (persona.decision_scenarios?.length > 0) {
      let scenariosText = "";
      for (const ds of persona.decision_scenarios) {
        const reasoning = ds.reasoning ? ` (근거: ${ds.reasoning})` : "";
        scenariosText += `- 상황: ${ds.situation}\n  → 판단: ${ds.decision}${reasoning}\n`;
      }
      sections.push(`## 의사결정 시나리오\n${scenariosText}`);
    }
  }

  // 대화 스타일 (둘 다 공통)
  if (persona.style) {
    sections.push(`## 대화 스타일\n${persona.style}`);
  }

  // 규칙
  const ruleBase = frameworkData
    ? `1. 위 판단 축과 패턴을 기반으로 구조화된 판단을 제공하세요.
2. 판단 시 적용한 축과 패턴을 명시하세요.
3. 해당 상황에 직접 매칭되는 패턴이 없으면, 가장 유사한 원칙을 기반으로 추론하세요.`
    : `1. 위 판단 원칙과 의사결정 시나리오를 기반으로, 전문가의 관점에서 조언하세요.
2. 아래 [보조 참고 자료]가 있으면 참고하되, 핵심은 판단 원칙입니다.`;

  sections.push(`## 중요한 규칙
${ruleBase}
${frameworkData ? "4" : "3"}. '${persona.name}'의 말투와 관점을 일관되게 유지하세요.
${frameworkData ? "5" : "4"}. 당신이 AI 페르소나임을 숨기지 마세요. 질문받으면 솔직히 밝히세요.
${frameworkData ? "6" : "5"}. 판단 원칙에도 없고 참고 자료에도 없는 내용은 "해당 내용은 제 경험 범위 밖입니다"라고 답하세요.`);

  // 보조 참고 자료 (RAG)
  if (context && context !== "(관련 자료 없음)") {
    sections.push(`## 보조 참고 자료\n${context}`);
  }

  return sections.join("\n\n");
}
```

### 4.2 판단 추출용 프롬프트

**파일: `src/lib/judgment-extractor.ts` (신규)**

LLM `extract<T>` 함수를 활용하여 텍스트에서 판단 패턴을 추출한다.

```typescript
// 판단 축 추출 프롬프트
const EXTRACT_AXES_PROMPT = `이 텍스트에서 전문가의 판단 축(의사결정 시 고려하는 핵심 기준)을 추출하세요.

각 축에 대해:
- name: 축 이름 (간결하게, 예: "확장성", "운영 복잡도")
- description: 이 축이 의미하는 것
- weight: 이 전문가가 얼마나 중시하는지 (0~1, 언급 빈도와 강조 정도로 추정)
- domain: 적용 분야 (null이면 범용)

JSON 배열로만 응답:
[{"name": "...", "description": "...", "weight": 0.8, "domain": null}]`;

// If-Then 패턴 추출 프롬프트
const EXTRACT_PATTERNS_PROMPT = `이 텍스트에서 전문가의 판단 패턴(If-Then 규칙)을 추출하세요.

각 패턴에 대해:
- condition: 조건 ("IF ..." 형식, 구체적으로)
- action: 행동 ("THEN ..." 형식, 실행 가능하게)
- reasoning: 이 패턴의 근거 (전문가가 왜 이렇게 하는지)

JSON 배열로만 응답:
[{"condition": "팀 규모 5명 미만이고 데드라인 6개월 이내", "action": "팀이 익숙한 기술 선택", "reasoning": "학습 비용이 프로젝트 리스크 증가"}]`;

// 경험 스토리 추출 프롬프트
const EXTRACT_STORIES_PROMPT = `이 텍스트에서 전문가의 구체적 경험 스토리를 추출하세요.

각 스토리에 대해:
- title: 제목 (한 줄 요약)
- summary: 요약 (2~3문장)
- context: 상황 배경 (어떤 상황이었는지)
- decision: 당시의 판단 (무엇을 결정했는지)
- outcome: 결과 (어떻게 되었는지, 모르면 null)
- lesson: 교훈 (이 경험에서 배운 것)

JSON 배열로만 응답:
[{"title": "...", "summary": "...", "context": "...", "decision": "...", "outcome": "...", "lesson": "..."}]`;
```

### 4.3 심층 질문 생성용 프롬프트

**파일: `src/lib/deep-interview.ts` (신규)**

```typescript
// 다음 질문 생성 프롬프트 (LLM chat 호출에 시스템 프롬프트로 사용)
const GENERATE_QUESTION_SYSTEM = `당신은 전문가의 판단 프레임워크를 추출하기 위한 인터뷰어입니다.

목표: 전문가가 "어떻게 판단하는지"의 뿌리까지 파고들어, 구조화된 판단 프레임워크를 구축하는 것.

현재까지 추출된 판단 프레임워크:
{CURRENT_FRAMEWORK}

현재까지의 인터뷰 진행 상황:
- 답변 수: {ANSWER_COUNT}
- 추출된 판단 축: {AXES_COUNT}개
- 추출된 If-Then 패턴: {PATTERNS_COUNT}개
- 추출된 경험 스토리: {STORIES_COUNT}개
- 포화도: {SATURATION}

다음 질문을 생성하세요. 다음 규칙을 따르세요:
1. 이미 충분히 탐색된 축은 건너뛰세요.
2. 가중치가 높은 축에 대해 더 깊이 파고드세요.
3. 질문 유형을 다양하게 사용하세요: why, how, what_if, discover_story, cross_validate
4. 전문가가 자연스럽게 답할 수 있는 질문으로 만드세요.
5. 한 번에 하나의 질문만 생성하세요.

JSON으로만 응답:
{"question": "질문 내용", "intent": "explore_why|explore_how|explore_what_if|discover_story|cross_validate|confirm", "target_axis": "관련 판단 축 이름 또는 null"}`;

// 포화도 계산: 최근 N개 답변에서 새로운 축/패턴 추출 여부
function calculateSaturation(recentExtractions: ExtractionResult[], windowSize = 3): number {
  if (recentExtractions.length < windowSize) return 0;
  const recent = recentExtractions.slice(-windowSize);
  const newItemsCount = recent.reduce((sum, e) =>
    sum + e.newAxes.length + e.newPatterns.length + e.newStories.length, 0
  );
  // 최근 window에서 새 항목이 0이면 포화도 1.0
  // 1~2개면 0.7, 3~5개면 0.3, 그 이상이면 0
  if (newItemsCount === 0) return 1.0;
  if (newItemsCount <= 2) return 0.7;
  if (newItemsCount <= 5) return 0.3;
  return 0;
}
```

---

## 5. 파일별 변경 계획

### 5.1 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/types/index.ts` | `JudgmentFramework`, `JudgmentAxis`, `IfThenPattern`, `ExperienceStory` 타입 추가 |
| `src/lib/prompt.ts` | `buildSystemPrompt`에 `frameworkData?` 파라미터 추가, 프레임워크 기반 프롬프트 생성 |
| `src/lib/interview-phases.ts` | deep 모드용 seed 질문 추가 (`DEEP_SEED_QUESTIONS`). 기존 `INTERVIEW_PHASES` 유지 |
| `src/app/api/interview/[personaId]/start/route.ts` | `mode` 파라미터 처리, deep 모드 시 LLM 기반 첫 질문 생성 |
| `src/app/api/interview/[personaId]/answer/route.ts` | deep 모드 분기: 패턴 추출 + 동적 질문 생성 |
| `src/app/api/external/chat/route.ts` | 프레임워크 조회 추가 → `buildSystemPrompt`에 전달 |
| `src/app/api/external/interview/route.ts` | `mode` 파라미터 전달 |
| `src/app/api/external/personas/create/route.ts` | 페르소나 생성 시 `judgment_frameworks` 자동 생성 |
| `src/app/api/files/[id]/process/route.ts` | 기존 STT + 청킹 후 판단 패턴 추출 파이프라인 추가 |
| `src/app/api/store/register/route.ts` | `check_quality_gate_v2` 호출로 변경 |
| `mcp/server.ts` | 4개 신규 도구 추가 + `interview` mode 파라미터 + `persona_list` 응답 확장 |
| `supabase/migrations/` | `003_judgment_framework.sql` 추가 |

### 5.2 신규 파일

| 파일 | 설명 |
|------|------|
| `src/lib/judgment-extractor.ts` | 판단 패턴 추출 엔진. `extract<T>`를 활용한 축/패턴/스토리 추출 함수 |
| `src/lib/deep-interview.ts` | 심층 인터뷰 엔진. 동적 질문 생성, 포화도 계산, phase 관리 |
| `src/lib/framework-loader.ts` | 프레임워크 데이터 조회 헬퍼. 페르소나 ID → 프레임워크 + axes + patterns 로드 |
| `src/app/api/interview/[personaId]/confirm/route.ts` | confirmation phase 처리 API |
| `src/app/api/personas/[id]/framework/route.ts` | GET: 프레임워크 조회, PATCH: 프레임워크 수정 |
| `src/app/api/external/consult/route.ts` | 판단 자문 API (MCP `consult_judgment` 백엔드) |
| `src/app/api/external/framework/route.ts` | 프레임워크 조회 API (MCP `get_framework` 백엔드) |
| `src/app/api/external/stories/route.ts` | 유사 스토리 검색 API (MCP `find_similar_story` 백엔드) |
| `src/app/api/external/compare/route.ts` | 접근법 비교 API (MCP `compare_approaches` 백엔드) |
| `supabase/migrations/003_judgment_framework.sql` | DB 마이그레이션 |

---

## 6. 호환성 전략

### 6.1 하위 호환 원칙

1. **DB**: 기존 테이블에 컬럼 추가만 수행한다 (`ALTER TABLE ... ADD COLUMN`). 기존 컬럼의 타입/제약은 변경하지 않는다.
2. **API**: 기존 엔드포인트의 응답 구조를 유지한다. 새 필드는 추가만 한다 (breaking change 없음).
3. **MCP**: 기존 8개 도구의 파라미터/응답은 그대로 유지한다. 새 파라미터는 optional로 추가한다.
4. **프레임워크 없는 페르소나**: `framework_id IS NULL`인 페르소나는 기존 로직(`principles` + `decision_scenarios` + RAG)으로 동작한다. 코드에서 `if (frameworkData)` 분기로 처리.

### 6.2 구체적 호환 포인트

#### `buildSystemPrompt`

```typescript
// 기존 호출 코드 (src/app/api/external/chat/route.ts 등)
const systemPrompt = buildSystemPrompt(persona as Persona, context);

// 변경 후: frameworkData가 undefined면 기존 동작 100% 유지
const frameworkData = await loadFramework(persona_id); // null if no framework
const systemPrompt = buildSystemPrompt(persona as Persona, context, frameworkData ?? undefined);
```

#### `interview` 도구

```typescript
// 기존 MCP 호출: mode 파라미터 없으면 기본값 "deep"
// 하지만 기존 API는 mode가 없으면 "classic"으로 처리
// → 하위 호환: mode가 없으면 "classic" (기존 9질문), 명시적으로 "deep" 전달 시 심층 인터뷰

// MCP 도구에서는 기본값을 "deep"으로 설정 (새 사용자)
// 웹 UI에서는 선택 가능하게 (classic / deep)
```

#### 품질 게이트

```typescript
// 기존 check_quality_gate는 유지 (기존 코드에서 호출하는 곳)
// 새 check_quality_gate_v2는 프레임워크 유무에 따라 v1/v2 자동 전환
// 스토어 등록 API만 v2로 변경하면 됨
```

### 6.3 점진적 마이그레이션

1. Phase 1에서 DB 마이그레이션 + 타입만 추가 (기존 코드 영향 0)
2. Phase 1에서 `buildSystemPrompt` 확장 (optional param이므로 기존 호출에 영향 0)
3. Phase 2에서 `upload_audio` 파이프라인 확장 (기존 RAG 파이프라인 유지 + 추출 추가)
4. Phase 3에서 MCP 도구 추가 (기존 도구 변경 최소화)
5. Phase 4에서 품질 게이트만 v2로 교체

### 6.4 롤백 전략

신규 테이블과 컬럼만 추가하므로, 문제 발생 시:
- `003_judgment_framework.sql`의 역 마이그레이션 실행 (테이블 DROP, 컬럼 DROP)
- 신규 파일 삭제
- 수정 파일의 분기문에서 프레임워크 로직이 null 체크로 보호되어 있으므로 기존 동작 자동 복구

---

## 7. 데이터 플로우 다이어그램

### 7.1 심층 인터뷰 플로우

```
사용자 답변
  │
  ├─→ interview_answers 저장
  │
  ├─→ LLM extract: 판단 축 추출 ──→ judgment_axes INSERT/UPDATE
  ├─→ LLM extract: If-Then 추출 ──→ if_then_patterns INSERT
  ├─→ LLM extract: 스토리 추출 ──→ experience_stories INSERT + embedText
  │
  ├─→ 포화도 계산 (최근 3 답변의 새 추출 수)
  │
  └─→ LLM generate: 다음 질문 생성
       (현재 프레임워크 + 답변 이력 → 다음 질문 + intent)
```

### 7.2 consult_judgment 플로우

```
MCP consult_judgment 요청
  │
  ├─→ API 키 검증
  ├─→ 페르소나 + judgment_frameworks 조회
  ├─→ judgment_axes + if_then_patterns 조회
  │
  ├─→ situation 임베딩
  │    ├─→ match_chunks (기존 RAG)
  │    └─→ match_stories (경험 스토리)
  │
  └─→ LLM chat:
       시스템 프롬프트 = buildSystemPrompt(persona, ragContext, frameworkData)
       + "다음 상황에 대해 구조화된 판단을 제공하세요: {situation}"
       + "JSON으로 응답: {judgment, reasoning, applicable_axes, ...}"
       │
       └─→ extract<ConsultResult> → 응답 반환
```

### 7.3 음성 업로드 확장 플로우

```
음성 파일 업로드
  │
  ├─→ [기존] STT → 텍스트
  │    └─→ 청킹 → embedText → chunks INSERT (RAG용)
  │
  └─→ [신규] 텍스트 전체 → LLM 판단 패턴 추출
       ├─→ 판단 축 → judgment_axes UPSERT
       ├─→ If-Then → if_then_patterns INSERT
       └─→ 스토리 → experience_stories INSERT + embedText
       │
       └─→ 프레임워크 status 갱신 (building 유지, 전문가 확인 필요)
```
