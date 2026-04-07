# Human Archive AI

전문가의 판단 체계를 AI 페르소나로 아카이빙하는 서비스.
은퇴하는 전문가의 경험과 노하우를 보존하고, 누구나 대화할 수 있게 합니다.

## 주요 기능

### 페르소나 생성
- 구조화된 인터뷰 (9개 질문: 전문분야, 판단원칙, 의사결정 시나리오, 대화스타일)
- 음성 파일 업로드 (STT + 임베딩)
- YouTube 자막, 문서 등 멀티소스 지식 아카이빙
- RAG 기반 전문가 응답 생성

### 페르소나 스토어
- 전문가가 자신의 AI 페르소나를 등록하여 판매
- 2문답 무료 시식(체험) 후 구매
- 카테고리별 검색 (기술, 비즈니스, 교육, 라이프스타일, 크리에이티브, 커리어)
- 구매한 페르소나와 무제한 대화
- 수익 분배: 판매자 80% / 플랫폼 20% (초기)

### MCP 연동
Claude Code, Claude Desktop에서 MCP를 통해 페르소나와 직접 대화할 수 있습니다.

## 기술 스택

- **프레임워크**: Next.js (App Router)
- **데이터베이스**: Supabase (PostgreSQL + pgvector + RLS)
- **인증**: Supabase Auth
- **LLM**: Gemini 3 Flash Preview
- **임베딩**: Gemini Embedding 001 (768차원)
- **결제**: Toss Payments
- **배포**: Vercel
- **MCP**: Model Context Protocol 서버

## 시작하기

### 환경변수 설정

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI
GEMINI_API_KEY=your_gemini_key

# 결제 (Phase 1)
TOSS_CLIENT_KEY=your_toss_client_key
TOSS_SECRET_KEY=your_toss_secret_key
```

### 로컬 개발

```bash
npm install
npm run dev
```

### 배포

```bash
vercel --prod
# 또는 git push (GitHub 연동 시 자동 배포)
```

## MCP 설정

Claude Code 또는 Claude Desktop에서 Human Archive AI 페르소나와 대화하려면 MCP 서버를 설정하세요.

### 설정 파일 (.mcp.json)

```json
{
  "mcpServers": {
    "human-archive-ai": {
      "command": "npx",
      "args": ["-y", "tsx",
        "https://raw.githubusercontent.com/youngjinpark-dev/human-archive-ai/main/mcp/server.ts"
      ],
      "env": {
        "HUMAN_ARCHIVE_API_URL": "https://human-archive-ai.vercel.app",
        "HUMAN_ARCHIVE_API_KEY": "ha_your_api_key_here"
      }
    }
  }
}
```

### MCP 도구 목록

| 도구 | 설명 |
|------|------|
| `persona_list` | 페르소나 목록 조회 |
| `persona_create` | 새 페르소나 생성 |
| `interview` | 인터뷰로 페르소나 구축 (9개 질문) |
| `upload_audio` | 음성 파일 업로드 및 임베딩 |
| `chat` | 페르소나와 대화 |
| `store_search` | 스토어에서 전문가 페르소나 검색 |
| `store_preview` | 스토어 페르소나 시식 (2회 무료) |
| `my_purchased_personas` | 구매한 페르소나 목록 조회 |

## API

모든 외부 API는 `x-api-key` 헤더로 인증합니다. API 키는 웹 대시보드에서 발급받을 수 있습니다.

### 페르소나 관리

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/external/personas` | 페르소나 목록 |
| POST | `/api/external/personas/create` | 페르소나 생성 |
| POST | `/api/external/interview` | 인터뷰 진행 |
| POST | `/api/external/upload` | 음성 파일 업로드 |
| POST | `/api/external/chat` | 페르소나와 대화 |

### 스토어

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/external/store` | 스토어 검색 |
| POST | `/api/external/store/[id]/trial` | 시식 (2회 무료) |
| GET | `/api/external/purchases` | 구매 목록 |

## 프로젝트 구조

```
src/
  app/
    (auth)/          # 로그인/회원가입
    (dashboard)/     # 대시보드 (페르소나, 스토어, 판매자)
    api/
      external/      # 외부 API (API 키 인증)
      store/         # 스토어 API
      personas/      # 페르소나 CRUD
      interview/     # 인터뷰 API
      files/         # 파일 업로드/처리
      payments/      # 결제 (Toss)
      seller/        # 판매자 대시보드
    .well-known/mcp/ # AI 에이전트용 MCP 가이드
  components/        # 공통 컴포넌트
  lib/               # 유틸리티 (LLM, 임베딩, 결제 등)
  types/             # TypeScript 타입
mcp/                 # MCP 서버
supabase/            # DB 마이그레이션
docs/                # 기획 문서
```

## 라이선스

Private
