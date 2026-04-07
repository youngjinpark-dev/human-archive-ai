# 판단 프레임워크 아카이빙 서비스 기획서

> Human Archive AI — "말투 모방"에서 "전문가 판단 아카이빙"으로의 전환

---

## 1. 서비스 비전

### 1.1 현재 상태 (AS-IS)

현재 Human Archive AI는 **표면적 페르소나 복제**에 머물러 있다.

| 영역 | 현재 수준 | 한계 |
|------|-----------|------|
| 인터뷰 | 4단계 9개 고정 질문 | 표면적 답변만 수집, 판단의 "why"를 파고들지 못함 |
| 데이터 구조 | `principles: string[]`, `decision_scenarios: jsonb` | 판단 축/가중치/조건부 로직 표현 불가 |
| 음성 업로드 | STT → 청킹 → 임베딩 | 비정형 텍스트 덩어리, 판단 패턴 미추출 |
| MCP 도구 | `chat` 단일 도구 | 범용 대화만 가능, 구조화된 판단 자문 불가 |
| 품질 게이트 | 인터뷰 완료 + 청크 1개 이상 | 판단 품질이 아닌 "양" 기준 |

### 1.2 목표 상태 (TO-BE)

**전문가의 판단 프레임워크를 구조화하여 아카이빙하고, MCP를 통해 AI 에이전트가 전문가의 판단을 자문받을 수 있는 서비스.**

핵심 전환:

```
[현재] 사용자 → chat → "전문가처럼 말하는 AI"
[목표] 사용자의 AI 에이전트 → consult_judgment → "전문가의 판단 프레임워크에 기반한 구조화된 자문"
```

- **말투 모방 → 판단 복제**: "어떻게 말하는가"가 아닌 "어떻게 판단하는가"를 아카이빙
- **수동 인터뷰 → 지능형 심층 인터뷰**: why → how → what if 연쇄로 판단의 뿌리까지 도달
- **단일 chat → 다중 자문 도구**: 상황별 최적 도구로 전문가의 판단에 접근
- **양적 품질 → 판단 품질**: 판단 축 커버리지, 스토리 다양성, 패턴 일관성 측정

---

## 2. 사용자 시나리오

### 2.1 전문가(판매자) 시나리오: 판단 프레임워크 구축

```
전문가: 15년 경력 백엔드 아키텍트 "김 수석"
```

**Phase 1: 심층 인터뷰**

```
시스템: "전문 분야가 무엇인가요?"
김수석: "대규모 트래픽 시스템 설계요"

시스템: "대규모 트래픽 시스템을 설계할 때 가장 먼저 확인하는 것은 무엇인가요?"
김수석: "예상 TPS와 데이터 특성이요"

시스템: "왜 TPS를 가장 먼저 확인하시나요? 다른 것보다 우선하는 이유가 있나요?"
김수석: "초기에 TPS 예측이 틀리면 아키텍처 자체를 갈아엎어야 해서요. 
        2019년에 이벤트 시스템에서 TPS를 과소 예측해서..."

시스템: "그 경험 이후로 TPS 예측 방법이 달라졌나요? 구체적으로 어떻게?"
김수석: "마케팅팀에 직접 물어보는 게 아니라, 과거 유사 이벤트 데이터를 
        기반으로 3배 버퍼를 잡아요"

→ 추출된 판단 패턴:
  - 판단 축: "확장성 > 기능 완성도" (가중치: 0.9)
  - If-Then: "IF 신규 시스템 설계 THEN 예상 TPS × 3 버퍼"
  - 경험 스토리: "2019년 이벤트 시스템 TPS 과소예측 사건"
  - 근거: "아키텍처 변경 비용 >> 초기 오버프로비저닝 비용"
```

**Phase 2: 음성 업로드 → 판단 패턴 자동 추출**

```
김수석이 "아키텍처 리뷰 미팅 녹음"을 업로드

→ 시스템이 자동 추출:
  - 3개의 새로운 If-Then 패턴
  - 2개의 경험 스토리
  - 기존 판단 축 "확장성"에 대한 보강 근거
  - 새로운 판단 축 발견: "운영 복잡도" (가중치 추정: 0.7)

→ 전문가에게 확인 요청:
  "다음 판단 패턴이 맞는지 확인해 주세요: ..."
```

**Phase 3: 스토어 등록**

```
품질 게이트 결과:
  - 판단 축: 4개 (최소 3개 충족) ✓
  - 경험 스토리: 7개 (최소 5개 충족) ✓
  - If-Then 패턴: 12개 (최소 8개 충족) ✓
  - 축 커버리지: 87% ✓
  - 판단 일관성: 92% ✓
  → 스토어 등록 가능
```

### 2.2 사용자(구매자) 시나리오: MCP 판단 자문

```
사용자: 3년차 백엔드 개발자, Claude Code에서 작업 중
사용자의 Claude: "김 수석" 페르소나를 MCP로 연결
```

**시나리오 A: 판단 자문 (consult_judgment)**

```
사용자 → Claude: "주문 시스템을 설계해야 하는데, 
                  PostgreSQL vs DynamoDB 어떤 걸 써야 할까?"

Claude → MCP consult_judgment:
  persona_id: "김수석-id"
  situation: "주문 시스템 DB 선택: PostgreSQL vs DynamoDB"
  context: { expected_tps: 500, team_size: 4, deadline: "3개월" }

MCP 응답:
  judgment: "PostgreSQL 추천"
  reasoning: "팀 규모 4명 + 3개월 데드라인 → 운영 복잡도 최소화 우선"
  applicable_axes: ["운영 복잡도(0.7)", "팀 역량 활용(0.6)"]
  relevant_pattern: "IF 팀 < 5명 AND 데드라인 < 6개월 THEN 팀이 익숙한 기술 선택"
  similar_story: "2021년 소규모 팀에서 새 기술 도입 → 데드라인 초과 경험"
  confidence: 0.85
  caveats: ["TPS 500이면 PostgreSQL 충분하나, 1만 이상 예상 시 재검토 필요"]

Claude → 사용자: "김수석님의 판단 프레임워크에 따르면 PostgreSQL을 추천합니다.
                  핵심 근거는 팀 규모와 데드라인을 고려한 운영 복잡도 최소화입니다..."
```

**시나리오 B: 프레임워크 조회 (get_framework)**

```
사용자 → Claude: "김수석님은 시스템 설계할 때 어떤 기준으로 판단하시는 거야?"

Claude → MCP get_framework:
  persona_id: "김수석-id"
  domain: "시스템 설계"

MCP 응답:
  axes: [
    { name: "확장성", weight: 0.9, description: "..." },
    { name: "운영 복잡도", weight: 0.7, description: "..." },
    ...
  ]
  key_patterns: [...]
  philosophy: "..."
```

**시나리오 C: 유사 경험 검색 (find_similar_story)**

```
사용자 → Claude: "마이크로서비스 전환하다 실패한 경험 있으신가요?"

Claude → MCP find_similar_story:
  persona_id: "김수석-id"
  query: "마이크로서비스 전환 실패"

MCP 응답:
  stories: [
    { title: "2020년 모놀리스→MSA 전환", relevance: 0.92, ... },
    { title: "2022년 이벤트 드리븐 전환", relevance: 0.71, ... }
  ]
```

**시나리오 D: 접근법 비교 (compare_approaches)**

```
사용자 → Claude: "Redis vs Memcached, 김수석님이라면 어떤 걸 선택하실까요?"

Claude → MCP compare_approaches:
  persona_id: "김수석-id"
  approaches: ["Redis", "Memcached"]
  context: "세션 캐싱 용도, 일 100만 요청"

MCP 응답:
  comparison: {
    recommended: "Redis",
    reasoning: "...",
    per_approach: [
      { name: "Redis", pros: [...], cons: [...], axes_alignment: {...} },
      { name: "Memcached", pros: [...], cons: [...], axes_alignment: {...} }
    ]
  }
```

---

## 3. 핵심 기능 정의

### 3.1 심층 인터뷰 엔진

#### 현재 → 변경

| 항목 | 현재 | 변경 |
|------|------|------|
| 질문 방식 | 4단계 9개 고정 질문 | 동적 생성, 최소 9개 ~ 최대 30개 |
| 질문 흐름 | 선형 (다음 질문 → 다음 질문) | 트리형 (답변 분석 → 후속 질문 분기) |
| 추출 | 단순 텍스트 저장 | 실시간 판단 패턴 추출 |
| 종료 조건 | 9개 질문 완료 | 판단 축 포화도 기반 (새로운 패턴 미발견 시 종료) |

#### 인터뷰 흐름

```
1. Seed Phase (고정 2~3개)
   - "전문 분야와 경력은?"
   - "이 분야에서 가장 중요하다고 생각하는 것은?"

2. Deep Dive Phase (동적, 답변 기반)
   각 답변에 대해:
   a. Why 연쇄: "왜 그렇게 판단하시나요?" → "그 근거는 어디서 왔나요?"
   b. How 구체화: "구체적으로 어떤 절차로 하시나요?"
   c. What-if 시나리오: "만약 [반대 상황]이라면 어떻게 하시나요?"
   d. 경험 발굴: "그런 판단을 하게 된 구체적 경험이 있나요?"

3. Cross-validation Phase (동적)
   - 추출된 판단 축 간 충돌 확인: "확장성과 비용이 충돌할 때는?"
   - 극단 시나리오: "예산이 0원이라면?", "시간이 1주일밖에 없다면?"

4. Confirmation Phase
   - 추출된 프레임워크 요약 → 전문가 확인/수정
```

#### 동적 질문 생성 로직

```typescript
// 개념적 구조 (prompt 기반)
interface InterviewEngine {
  // 현재까지 추출된 판단 패턴을 기반으로 다음 질문 생성
  generateNextQuestion(
    context: {
      answers: InterviewAnswer[];          // 지금까지의 답변
      extractedAxes: JudgmentAxis[];       // 추출된 판단 축
      extractedPatterns: IfThenPattern[];  // 추출된 패턴
      extractedStories: ExperienceStory[]; // 추출된 스토리
      saturationScore: number;             // 포화도 (0~1)
    }
  ): { question: string; intent: QuestionIntent; targetAxis?: string };

  // 답변에서 판단 패턴 실시간 추출
  extractFromAnswer(
    question: string,
    answer: string,
    existingFramework: JudgmentFramework
  ): ExtractionResult;
}

type QuestionIntent = 
  | "explore_why"       // 판단 근거 탐색
  | "explore_how"       // 구체적 방법론 탐색
  | "explore_what_if"   // 반례/극단 시나리오
  | "discover_story"    // 경험 발굴
  | "cross_validate"    // 축 간 충돌 확인
  | "confirm"           // 추출 결과 확인
```

LLM에게 현재까지의 인터뷰 컨텍스트와 추출된 패턴을 전달하고, 다음 질문을 생성하도록 프롬프트한다. 고정 질문 목록이 아닌 **프롬프트 기반 동적 생성**.

### 3.2 음성 → 판단 프레임워크 자동 추출 파이프라인

#### 현재 파이프라인

```
음성 → STT → 텍스트 → 청킹(800자) → 임베딩 → pgvector
```

#### 개편 파이프라인

```
음성 → STT → 텍스트
  ├→ [기존 유지] 청킹 → 임베딩 → pgvector (RAG 검색용)
  └→ [신규] 판단 패턴 추출 엔진
       ├→ 판단 축 식별/보강
       ├→ If-Then 패턴 추출
       ├→ 경험 스토리 추출
       └→ 기존 프레임워크와 병합 → 전문가 확인 요청
```

#### 추출 엔진 구조

```typescript
// LLM 기반 추출 (기존 extract<T> 함수 활용)
interface JudgmentExtractor {
  // 텍스트에서 판단 패턴 추출
  extractJudgmentPatterns(
    text: string,
    existingFramework: JudgmentFramework  // 중복 방지를 위해 기존 프레임워크 전달
  ): Promise<ExtractionResult>;
}

interface ExtractionResult {
  newAxes: JudgmentAxis[];
  reinforcedAxes: { axisId: string; newEvidence: string }[];
  newPatterns: IfThenPattern[];
  newStories: ExperienceStory[];
  conflicts: ConflictReport[];  // 기존 패턴과 충돌하는 새 패턴
}
```

### 3.3 판단 자문 MCP 도구

기존 `chat` 도구를 유지하면서 4개의 새로운 도구를 추가한다.

#### 3.3.1 `consult_judgment` — 판단 자문

```
입력:
  - persona_id: string
  - situation: string          — 판단이 필요한 상황 설명
  - context?: object           — 추가 컨텍스트 (예산, 기한, 팀 규모 등)
  - constraints?: string[]     — 제약 조건

출력:
  - judgment: string           — 판단 결론
  - reasoning: string          — 판단 근거 (프레임워크 기반)
  - applicable_axes: object[]  — 적용된 판단 축과 가중치
  - relevant_patterns: object[] — 매칭된 If-Then 패턴
  - similar_story?: object     — 가장 유사한 경험 스토리
  - confidence: number         — 판단 신뢰도 (0~1)
  - caveats: string[]          — 주의사항/한계
```

내부 동작:
1. `situation`을 임베딩하여 관련 청크(RAG) 검색
2. 판단 축 + If-Then 패턴 매칭
3. 유사 경험 스토리 검색
4. LLM에 프레임워크 + RAG 컨텍스트 전달 → 구조화된 판단 생성

#### 3.3.2 `get_framework` — 프레임워크 조회

```
입력:
  - persona_id: string
  - domain?: string            — 특정 도메인 필터 (선택)

출력:
  - axes: JudgmentAxis[]       — 판단 축 목록 (가중치 포함)
  - key_patterns: IfThenPattern[] — 핵심 패턴 (상위 N개)
  - philosophy: string         — 종합 판단 철학 요약
  - domains: string[]          — 커버하는 도메인 목록
```

#### 3.3.3 `find_similar_story` — 유사 경험 검색

```
입력:
  - persona_id: string
  - query: string              — 검색할 상황/키워드

출력:
  - stories: Array<{
      id: string
      title: string
      summary: string
      context: string          — 상황 배경
      decision: string         — 당시 판단
      outcome: string          — 결과
      lesson: string           — 교훈
      relevance: number        — 관련도 (0~1)
    }>
```

내부 동작: 쿼리를 임베딩 → `experience_stories` 테이블에서 유사도 검색 + LLM 재순위화

#### 3.3.4 `compare_approaches` — 접근법 비교

```
입력:
  - persona_id: string
  - approaches: string[]       — 비교할 접근법 (2~5개)
  - context?: string           — 상황 설명

출력:
  - recommended: string        — 추천 접근법
  - reasoning: string          — 추천 근거
  - per_approach: Array<{
      name: string
      pros: string[]
      cons: string[]
      axes_alignment: object   — 각 판단 축에 대한 부합도
      risk_level: "low" | "medium" | "high"
    }>
  - relevant_stories: object[] — 관련 경험
```

---

## 4. 데이터 모델

### 4.1 신규 테이블

#### `judgment_frameworks` — 판단 프레임워크 (페르소나당 1개)

```sql
create table judgment_frameworks (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null unique references personas(id) on delete cascade,
  philosophy text,                          -- 종합 판단 철학 요약
  domains text[] default '{}',              -- 커버하는 도메인
  version int default 1,                    -- 프레임워크 버전 (수정 시 증가)
  status text default 'building'            -- building | ready | archived
    check (status in ('building', 'ready', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### `judgment_axes` — 판단 축

```sql
create table judgment_axes (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references judgment_frameworks(id) on delete cascade,
  name text not null,                       -- 예: "확장성", "운영 복잡도"
  description text,                         -- 이 축이 의미하는 것
  weight numeric(3,2) default 0.5,          -- 가중치 (0~1)
  domain text,                              -- 적용 도메인 (null이면 범용)
  evidence_count int default 0,             -- 이 축을 뒷받침하는 근거 수
  created_at timestamptz default now()
);
```

#### `if_then_patterns` — If-Then 판단 패턴

```sql
create table if_then_patterns (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references judgment_frameworks(id) on delete cascade,
  condition text not null,                  -- "IF 팀 < 5명 AND 데드라인 < 6개월"
  action text not null,                     -- "THEN 팀이 익숙한 기술 선택"
  reasoning text,                           -- 이 패턴의 근거
  axis_id uuid references judgment_axes(id) on delete set null, -- 관련 판단 축
  confidence numeric(3,2) default 0.5,      -- 패턴 신뢰도
  source_type text not null                 -- 'interview' | 'audio' | 'manual'
    check (source_type in ('interview', 'audio', 'manual')),
  source_id uuid,                           -- 출처 (interview_answer.id 또는 file_upload.id)
  created_at timestamptz default now()
);
```

#### `experience_stories` — 경험 스토리

```sql
create table experience_stories (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references judgment_frameworks(id) on delete cascade,
  title text not null,                      -- 스토리 제목
  summary text not null,                    -- 요약 (검색용)
  context text not null,                    -- 상황 배경
  decision text not null,                   -- 당시의 판단
  outcome text,                             -- 결과
  lesson text,                              -- 교훈
  related_axes uuid[] default '{}',         -- 관련 판단 축 ID들
  embedding vector(768),                    -- 유사도 검색용 임베딩
  source_type text not null
    check (source_type in ('interview', 'audio', 'manual')),
  source_id uuid,
  created_at timestamptz default now()
);

create index stories_embedding_idx on experience_stories 
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

### 4.2 기존 테이블 변경

#### `personas` — 확장 (기존 컬럼 유지)

기존 `principles`, `decision_scenarios`, `style` 컬럼은 유지한다. 이 데이터는 기존 `chat` 도구에서 계속 사용된다. 새 판단 프레임워크는 별도 테이블(`judgment_frameworks`)에 저장하되, 기존 데이터를 마이그레이션하여 프레임워크의 초기 데이터로 활용한다.

```sql
-- 기존 personas 테이블에 프레임워크 연결 참조만 추가
alter table personas add column framework_id uuid references judgment_frameworks(id);
```

#### `interview_sessions` — 확장

```sql
-- 심층 인터뷰 지원을 위한 컬럼 추가
alter table interview_sessions add column mode text default 'classic'
  check (mode in ('classic', 'deep'));       -- classic: 기존 9질문, deep: 심층 인터뷰
alter table interview_sessions add column total_questions int default 0;
alter table interview_sessions add column saturation_score numeric(3,2) default 0;
```

#### `interview_answers` — 확장

```sql
-- 판단 패턴 추출 결과 저장
alter table interview_answers add column extracted_axes jsonb default '[]';
alter table interview_answers add column extracted_patterns jsonb default '[]';
alter table interview_answers add column extracted_stories jsonb default '[]';
alter table interview_answers add column question_intent text;  -- 질문 의도
```

### 4.3 TypeScript 타입 (신규)

```typescript
// 판단 프레임워크
interface JudgmentFramework {
  id: string;
  persona_id: string;
  philosophy: string | null;
  domains: string[];
  version: number;
  status: 'building' | 'ready' | 'archived';
  created_at: string;
  updated_at: string;
}

// 판단 축
interface JudgmentAxis {
  id: string;
  framework_id: string;
  name: string;
  description: string | null;
  weight: number;          // 0~1
  domain: string | null;
  evidence_count: number;
  created_at: string;
}

// If-Then 판단 패턴
interface IfThenPattern {
  id: string;
  framework_id: string;
  condition: string;
  action: string;
  reasoning: string | null;
  axis_id: string | null;
  confidence: number;      // 0~1
  source_type: 'interview' | 'audio' | 'manual';
  source_id: string | null;
  created_at: string;
}

// 경험 스토리
interface ExperienceStory {
  id: string;
  framework_id: string;
  title: string;
  summary: string;
  context: string;
  decision: string;
  outcome: string | null;
  lesson: string | null;
  related_axes: string[];
  embedding: number[];
  source_type: 'interview' | 'audio' | 'manual';
  source_id: string | null;
  created_at: string;
}
```

### 4.4 데이터 관계도

```
personas (1) ←→ (1) judgment_frameworks
                        ├── (N) judgment_axes
                        ├── (N) if_then_patterns → judgment_axes
                        └── (N) experience_stories → judgment_axes[]
                        
personas (1) ←→ (N) chunks              [기존 RAG, 유지]
personas (1) ←→ (N) interview_sessions   [기존 + deep 모드]
```

---

## 5. 기존 기능과의 호환성

### 5.1 기본 원칙

**기존 기능은 100% 유지하면서 확장한다.** 기존 사용자의 페르소나, 구매, 채팅 기록이 깨지지 않아야 한다.

### 5.2 호환성 매트릭스

| 기존 기능 | 유지 여부 | 변경 사항 |
|-----------|-----------|-----------|
| `chat` MCP 도구 | 유지 | 프레임워크 존재 시 시스템 프롬프트에 판단 축/패턴 포함 |
| `interview` MCP 도구 | 유지 | `mode` 파라미터 추가 (`classic` / `deep`), 기본값 `deep` |
| `upload_audio` MCP 도구 | 유지 | 기존 RAG 파이프라인 + 판단 패턴 추출 파이프라인 병렬 실행 |
| `store_search` | 유지 | 검색 결과에 프레임워크 품질 정보 추가 |
| `store_preview` | 유지 | 변경 없음 |
| `my_purchased_personas` | 유지 | 변경 없음 |
| `persona_list` | 유지 | 응답에 프레임워크 상태 추가 |
| `persona_create` | 유지 | 프레임워크 자동 생성 (status: 'building') |
| `buildSystemPrompt` | 유지 | 프레임워크 데이터를 시스템 프롬프트에 통합하도록 확장 |
| 스토어 품질 게이트 | 개편 | 판단 프레임워크 품질 기준 추가 (아래 6절) |
| 기존 페르소나 데이터 | 유지 | `principles`, `decision_scenarios`는 그대로 유지. 프레임워크 마이그레이션은 선택적 |

### 5.3 마이그레이션 전략

기존 페르소나에 대해 자동으로 판단 프레임워크를 생성하지 않는다. 대신:

1. **신규 페르소나**: `persona_create` 시 `judgment_frameworks` 자동 생성 (status: `building`)
2. **기존 페르소나**: 대시보드에 "판단 프레임워크 구축" 버튼 제공. 클릭 시:
   - `principles` → `judgment_axes`로 변환 (LLM 기반)
   - `decision_scenarios` → `if_then_patterns` + `experience_stories`로 변환
   - 기존 `chunks`에서 판단 패턴 재추출
3. **하위 호환성**: 프레임워크가 없는 페르소나는 기존 방식(`principles` + `decision_scenarios` + RAG)으로 동작

### 5.4 `buildSystemPrompt` 확장

```typescript
// 프레임워크가 있는 경우 시스템 프롬프트 구성 변경
function buildSystemPrompt(
  persona: Persona, 
  context: string,
  framework?: JudgmentFramework & {
    axes: JudgmentAxis[];
    patterns: IfThenPattern[];
  }
): string {
  // 기존 로직 유지 (프레임워크 없으면 기존 방식)
  // 프레임워크 있으면 추가 섹션:
  //   ## 판단 프레임워크
  //   ## 판단 축 (가중치 포함)
  //   ## 핵심 판단 패턴 (If-Then)
}
```

---

## 6. 품질 게이트 개편

### 6.1 현재 품질 게이트

```sql
-- 현재 check_quality_gate 함수
eligible = interview_complete AND chunks_count >= 1
```

문제: **양**만 체크한다. 인터뷰를 대충 해도 통과한다.

### 6.2 새 품질 게이트

#### 필수 조건 (must-pass)

| 항목 | 기준 | 측정 방법 |
|------|------|-----------|
| 판단 축 수 | >= 3개 | `judgment_axes` count |
| If-Then 패턴 수 | >= 8개 | `if_then_patterns` count |
| 경험 스토리 수 | >= 5개 | `experience_stories` count |
| 인터뷰 완료 | deep 모드 완료 | `interview_sessions.mode = 'deep' AND completed = true` |

#### 품질 점수 (0~100, 60점 이상 통과)

```typescript
interface QualityScore {
  // 1. 축 커버리지 (25점)
  // 인터뷰/음성에서 언급된 주제 대비 판단 축이 커버하는 비율
  axisCoverage: number;

  // 2. 패턴 구체성 (25점)
  // If-Then 패턴이 구체적인 조건과 행동을 포함하는 비율
  // LLM이 각 패턴을 평가: "구체적 조건이 있는가?", "실행 가능한 행동인가?"
  patternSpecificity: number;

  // 3. 스토리 다양성 (25점)
  // 경험 스토리들의 임베딩 간 평균 거리 (다양할수록 높은 점수)
  storyDiversity: number;

  // 4. 판단 일관성 (25점)
  // 판단 축과 If-Then 패턴 사이의 논리적 일관성
  // LLM이 프레임워크 전체를 읽고 모순을 탐지
  judgmentConsistency: number;

  total: number;  // 위 4개의 합 (0~100)
}
```

#### 개편된 `check_quality_gate` 함수

```sql
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
  -- 기존 호환성 필드
  v_interview_complete boolean;
  v_chunks_count int;
  v_principles_count int;
  v_scenarios_count int;
begin
  -- 프레임워크 존재 확인
  select jf.id into v_framework_id
  from judgment_frameworks jf
  where jf.persona_id = target_persona_id and jf.status = 'ready';

  -- 프레임워크 없으면 기존 로직 (하위 호환)
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

  -- 품질 점수는 API 레이어에서 LLM으로 계산 (DB 함수에서는 수량만)
  result := jsonb_build_object(
    'version', 2,
    'framework_id', v_framework_id,
    'deep_interview_complete', v_deep_interview,
    'axes_count', v_axes_count,
    'patterns_count', v_patterns_count,
    'stories_count', v_stories_count,
    'must_pass', v_must_pass
    -- quality_score는 API에서 별도 계산 후 store_listings.quality_score에 저장
  );

  return result;
end;
$$;
```

### 6.3 품질 점수 산출 파이프라인

품질 점수의 4개 항목 중 `patternSpecificity`와 `judgmentConsistency`는 LLM 평가가 필요하므로 DB 함수가 아닌 API 레이어에서 계산한다.

```
스토어 등록 요청
  → check_quality_gate_v2 (DB, 수량 체크)
  → must_pass 통과 시:
    → LLM 품질 평가 (패턴 구체성 + 판단 일관성)
    → 스토리 다양성 (임베딩 거리 계산)
    → 축 커버리지 (인터뷰 답변 주제 vs 축)
    → total >= 60 → 등록 가능
```

---

## 7. 구현 우선순위

### Phase 1: 기반 구축 (핵심)

1. DB 마이그레이션: 신규 테이블 + 기존 테이블 확장
2. TypeScript 타입 추가
3. 심층 인터뷰 엔진 (동적 질문 생성 + 실시간 추출)
4. `buildSystemPrompt` 확장

### Phase 2: 추출 파이프라인

5. 음성 → 판단 패턴 추출 엔진
6. 기존 `upload_audio` 파이프라인 확장

### Phase 3: MCP 도구

7. `consult_judgment` 구현
8. `get_framework` 구현
9. `find_similar_story` 구현
10. `compare_approaches` 구현

### Phase 4: 품질 & 스토어

11. 품질 게이트 v2 구현
12. 스토어 연동 (프레임워크 품질 표시)
13. 기존 페르소나 마이그레이션 도구

---

## 8. 기술적 고려사항

### 8.1 LLM 의존도

심층 인터뷰와 판단 추출은 LLM에 크게 의존한다. 현재 Gemini Flash를 사용하고 있으므로:
- 추출 프롬프트는 구조화된 JSON 출력을 요구 (기존 `extract<T>` 활용)
- 프롬프트 품질이 서비스 품질을 결정하므로, 프롬프트 버전 관리 필요
- 추출 결과는 반드시 전문가 확인을 거쳐야 함 (자동 확정 방지)

### 8.2 임베딩

- 경험 스토리 검색을 위해 `experience_stories` 테이블에 임베딩 컬럼 추가
- 기존 `chunks` 임베딩과 동일한 모델(768차원) 사용하여 일관성 유지
- `match_chunks`와 유사한 `match_stories` RPC 함수 필요

### 8.3 비용 관리

- 심층 인터뷰: 질문당 LLM 호출 2회 (다음 질문 생성 + 패턴 추출) → 최대 30질문 × 2 = 60회
- 음성 추출: 트랜스크립트 전체를 한 번에 분석 (청크 단위 X) → 1회 호출
- 자문 도구: 호출당 1~2회 LLM 호출
- Gemini Flash 기준 비용이 낮지만, 모델 전환 시 재검토 필요
