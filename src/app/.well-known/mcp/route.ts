import { NextResponse } from "next/server";

// GET /.well-known/mcp — AI agent가 읽을 수 있는 MCP 설정 가이드
// 브라우저에서는 JSON이므로 일반 사용자에게 노출되지 않음
export async function GET() {
  return NextResponse.json({
    name: "Human Archive AI",
    description:
      "전문가의 판단 체계를 AI 페르소나로 아카이빙하는 서비스. MCP를 통해 페르소나와 대화할 수 있습니다.",
    mcp_version: "1.0.0",
    setup: {
      steps: [
        {
          step: 1,
          title: "회원가입 및 로그인",
          description:
            "사용자가 계정이 없다면 https://human-archive-ai.vercel.app/signup 에서 회원가입 후 https://human-archive-ai.vercel.app/login 에서 로그인하도록 안내하세요.",
        },
        {
          step: 2,
          title: "페르소나 생성",
          description:
            "페르소나가 없으면 MCP로 대화할 수 없습니다. https://human-archive-ai.vercel.app/personas/new 에서 페르소나를 생성하세요. 이름, 전문 분야, 설명을 입력하여 전문가의 판단 체계를 담는 AI 인격을 만듭니다.",
        },
        {
          step: 3,
          title: "API 키 발급",
          description:
            "사용자에게 API 키가 있는지 확인하세요. 없다면 https://human-archive-ai.vercel.app/api-keys 에서 발급받도록 안내하세요. API 키는 생성 시 한 번만 표시되며 ha_ 로 시작합니다.",
        },
        {
          step: 4,
          title: "MCP 설정 파일 생성",
          description:
            "프로젝트 루트에 .mcp.json 파일을 생성하세요. Claude Desktop의 경우 ~/Library/Application Support/Claude/claude_desktop_config.json (Mac) 또는 %APPDATA%\\Claude\\claude_desktop_config.json (Windows)에 설정합니다.",
          config: {
            mcpServers: {
              "human-archive-ai": {
                command: "npx",
                args: [
                  "-y",
                  "tsx",
                  "https://raw.githubusercontent.com/youngjinpark-dev/human-archive-ai/main/mcp/server.ts",
                ],
                env: {
                  HUMAN_ARCHIVE_API_URL:
                    "https://human-archive-ai.vercel.app",
                  HUMAN_ARCHIVE_API_KEY: "<USER_API_KEY>",
                },
              },
            },
          },
        },
        {
          step: 5,
          title: "연결 확인",
          description:
            "설정 완료 후 Claude Code에서 /mcp 명령으로 MCP 서버를 재연결하세요. persona_list 도구로 페르소나 목록이 정상 조회되면 설정 완료입니다.",
        },
      ],
    },
    tools: [
      {
        name: "persona_list",
        description:
          "API 키에 연결된 페르소나 목록을 조회합니다. 파라미터 없음. 페르소나가 없으면 생성 안내를 반환합니다.",
      },
      {
        name: "persona_create",
        description:
          "새 전문가 페르소나를 생성합니다. 생성 후 interview나 upload_audio로 지식을 아카이빙할 수 있습니다.",
        parameters: {
          name: "페르소나 이름 (필수)",
          domain: "전문 분야 (선택)",
          description: "페르소나 설명 (선택)",
          style: "대화 스타일 (선택)",
        },
      },
      {
        name: "interview",
        description:
          "9개의 구조화된 질문(전문분야 2, 판단원칙 3, 의사결정 시나리오 3, 대화스타일 1)으로 전문가의 판단 체계를 아카이빙합니다. action='start'로 시작, action='answer'로 답변을 제출합니다.",
        parameters: {
          persona_id: "페르소나 UUID",
          action: "'start' 또는 'answer'",
          session_id: "인터뷰 세션 ID (answer 시 필수)",
          answer: "사용자의 답변 (answer 시 필수)",
        },
      },
      {
        name: "upload_audio",
        description:
          "음성 파일을 업로드하여 페르소나의 지식을 아카이빙합니다. 음성→텍스트 변환(STT)→임베딩→RAG 검색 가능. 지원 형식: mp3, wav, m4a, ogg, webm.",
        parameters: {
          persona_id: "페르소나 UUID",
          file_path: "음성 파일의 로컬 절대 경로",
        },
      },
      {
        name: "chat",
        description: "페르소나와 대화합니다.",
        parameters: {
          persona_id: "페르소나 UUID (persona_list로 확인 가능)",
          message: "페르소나에게 보낼 메시지",
        },
      },
      {
        name: "store_search",
        description:
          "스토어에서 전문가 페르소나를 검색합니다. 카테고리: technology, business, education, lifestyle, creative, career",
        parameters: {
          query: "검색어 (선택)",
          category: "카테고리 필터 (선택)",
        },
      },
      {
        name: "store_preview",
        description:
          "스토어 페르소나를 시식(체험)합니다. 페르소나당 2회 무료 대화 가능. 체험 후 웹에서 구매할 수 있습니다.",
        parameters: {
          listing_id: "스토어 리스팅 ID (store_search 결과에서 확인)",
          message: "페르소나에게 보낼 메시지",
        },
      },
      {
        name: "my_purchased_personas",
        description:
          "구매한 페르소나 목록을 조회합니다. 구매한 페르소나는 chat 도구로 무제한 대화 가능합니다.",
      },
      {
        name: "consult_judgment",
        description:
          "전문가의 판단 프레임워크를 기반으로 특정 상황에 대한 판단을 자문합니다. 판단 축, 경험 스토리, if-then 패턴을 종합하여 '이 전문가라면 어떻게 판단할까'를 답변합니다.",
        parameters: {
          persona_id: "페르소나 UUID",
          situation: "판단이 필요한 상황 설명",
        },
      },
      {
        name: "get_framework",
        description:
          "전문가의 판단 프레임워크를 조회합니다. 판단 축, if-then 패턴, 경험 스토리 목록을 구조화된 형태로 반환합니다.",
        parameters: {
          persona_id: "페르소나 UUID",
        },
      },
      {
        name: "find_similar_story",
        description:
          "전문가의 경험 스토리 중 현재 상황과 유사한 에피소드를 검색합니다. RAG 기반 유사도 검색으로 관련 스토리를 찾습니다.",
        parameters: {
          persona_id: "페르소나 UUID",
          query: "검색할 상황이나 키워드",
        },
      },
      {
        name: "compare_approaches",
        description:
          "두 가지 접근법에 대해 전문가의 관점으로 비교 분석합니다. 각 접근법의 장단점을 판단 프레임워크에 기반하여 평가합니다.",
        parameters: {
          persona_id: "페르소나 UUID",
          approach_a: "첫 번째 접근법",
          approach_b: "두 번째 접근법",
          context: "상황 설명 (선택)",
        },
      },
    ],
    workflow: {
      create_persona: {
        description: "페르소나가 없을 때 권장 워크플로우",
        steps: [
          "1. persona_create로 페르소나 생성 (이름, 전문분야, 설명)",
          "2. interview로 9개 질문 인터뷰 진행 → 판단 체계 구조화",
          "3. upload_audio로 음성 파일 업로드 → 추가 지식 임베딩 (선택)",
          "4. chat으로 완성된 페르소나와 대화",
        ],
        note: "인터뷰와 음성 업로드는 선택사항이지만 진행할수록 페르소나 답변 품질이 높아집니다. mode='deep'으로 심층 인터뷰를 진행하면 판단 프레임워크가 자동 구축됩니다.",
      },
      judgment: {
        description: "전문가의 판단 프레임워크를 활용하는 워크플로우",
        steps: [
          "1. get_framework로 전문가의 판단 프레임워크 조회",
          "2. consult_judgment로 특정 상황에 대한 판단 자문",
          "3. find_similar_story로 유사 경험 스토리 검색",
          "4. compare_approaches로 접근법 비교 분석",
        ],
        note: "판단 프레임워크는 심층 인터뷰(mode='deep') 또는 음성 업로드를 통해 구축됩니다.",
      },
      store: {
        description: "스토어에서 전문가 페르소나를 검색하고 구매하는 워크플로우",
        steps: [
          "1. store_search로 원하는 분야의 전문가 페르소나 검색",
          "2. store_preview로 2회 무료 시식(체험) — 페르소나 품질 확인",
          "3. 웹(https://human-archive-ai.vercel.app/store)에서 결제하여 구매",
          "4. my_purchased_personas로 구매 확인",
          "5. chat 도구로 구매한 페르소나와 무제한 대화",
        ],
        note: "시식은 페르소나당 2회, 하루 3개 페르소나까지 가능합니다. 구매는 웹에서만 가능합니다.",
      },
    },
    api: {
      base_url: "https://human-archive-ai.vercel.app",
      authentication: "x-api-key 헤더에 API 키를 전달",
      endpoints: [
        {
          method: "GET",
          path: "/api/external/personas",
          description: "페르소나 목록 조회",
        },
        {
          method: "POST",
          path: "/api/external/personas/create",
          description: "페르소나 생성",
          body: { name: "string (필수)", domain: "string", description: "string", style: "string" },
        },
        {
          method: "POST",
          path: "/api/external/interview",
          description: "인터뷰 진행 (start/answer)",
          body: {
            persona_id: "string (UUID)",
            action: "'start' | 'answer'",
            session_id: "string (answer 시)",
            answer: "string (answer 시)",
          },
        },
        {
          method: "POST",
          path: "/api/external/upload",
          description: "음성 파일 업로드 및 처리 (FormData)",
          body: { file: "File", persona_id: "string (UUID)" },
        },
        {
          method: "POST",
          path: "/api/external/chat",
          description: "페르소나와 대화",
          body: { persona_id: "string (UUID)", message: "string" },
        },
        {
          method: "GET",
          path: "/api/external/store",
          description: "스토어 페르소나 검색",
          query: { q: "검색어", category: "카테고리", sort: "newest|popular|rating", page: "페이지", limit: "개수" },
        },
        {
          method: "POST",
          path: "/api/external/store/[id]/trial",
          description: "스토어 페르소나 시식 (2회 무료)",
          body: { message: "string" },
        },
        {
          method: "GET",
          path: "/api/external/purchases",
          description: "구매한 페르소나 목록 조회",
        },
        {
          method: "POST",
          path: "/api/external/consult",
          description: "판단 자문 (판단 프레임워크 기반)",
          body: { persona_id: "string (UUID)", situation: "string" },
        },
        {
          method: "GET",
          path: "/api/external/framework",
          description: "판단 프레임워크 조회",
          query: { persona_id: "UUID" },
        },
        {
          method: "POST",
          path: "/api/external/stories",
          description: "유사 경험 스토리 검색",
          body: { persona_id: "string (UUID)", query: "string" },
        },
        {
          method: "POST",
          path: "/api/external/compare",
          description: "접근법 비교 분석",
          body: { persona_id: "string (UUID)", approach_a: "string", approach_b: "string", context: "string (선택)" },
        },
      ],
    },
  });
}
