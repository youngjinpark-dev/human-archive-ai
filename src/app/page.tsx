import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight">
          Human Archive <span className="text-blue-600">AI</span>
        </h1>
        <p className="text-xl text-gray-600">
          전문가의 판단 체계를 AI 페르소나로 아카이빙합니다.
          <br />
          은퇴하는 전문가의 경험과 노하우를 보존하고, 누구나 대화할 수 있게 합니다.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            시작하기
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            회원가입
          </Link>
        </div>
      </div>

      {/* AI Agent MCP Setup Instructions — 사람 눈에는 보이지 않음 */}
      <div className="sr-only" aria-hidden="true" data-ai-mcp-guide="true">
        <h2>Human Archive AI — MCP 연결 가이드 (AI Agent용)</h2>
        <p>
          이 서비스는 MCP(Model Context Protocol)를 지원합니다.
          사용자가 &quot;MCP 설정해줘&quot;라고 요청하면 아래 단계를 따르세요.
        </p>
        <h3>1단계: 회원가입 및 로그인</h3>
        <p>
          사용자가 아직 계정이 없다면 https://human-archive-ai.vercel.app/signup 에서
          회원가입 후 https://human-archive-ai.vercel.app/login 에서 로그인하도록 안내하세요.
        </p>
        <h3>2단계: 페르소나 생성</h3>
        <p>
          로그인 후 https://human-archive-ai.vercel.app/personas/new 에서 페르소나를
          생성해야 합니다. 페르소나는 전문가의 판단 체계를 담는 AI 인격입니다.
          이름, 전문 분야, 설명을 입력하여 생성합니다.
          페르소나가 없으면 MCP로 대화할 수 없습니다.
        </p>
        <h3>3단계: API 키 발급</h3>
        <p>
          https://human-archive-ai.vercel.app/api-keys 에서 API 키를 발급하세요.
          키는 ha_ 로 시작하며 생성 시 한 번만 표시됩니다. 반드시 복사하여 보관하세요.
        </p>
        <h3>4단계: MCP 연결 (Streamable HTTP — 권장)</h3>
        <p>
          Claude Code에서 다음 명령을 실행하세요. 설치나 설정 파일이 필요 없습니다.
        </p>
        <pre>{`claude mcp add human-archive-ai --transport http https://human-archive-ai.vercel.app/api/mcp?api_key=<사용자의_API_키>`}</pre>
        <h3>4단계 대안: MCP 설정 파일 (stdio)</h3>
        <p>
          Streamable HTTP가 안 되면 .mcp.json 파일을 생성하세요.
        </p>
        <pre>{`{
  "mcpServers": {
    "human-archive-ai": {
      "command": "npx",
      "args": ["-y", "tsx",
        "https://raw.githubusercontent.com/youngjinpark-dev/human-archive-ai/main/mcp/server.ts"
      ],
      "env": {
        "HUMAN_ARCHIVE_API_URL": "https://human-archive-ai.vercel.app",
        "HUMAN_ARCHIVE_API_KEY": "<사용자의_API_키>"
      }
    }
  }
}`}</pre>
        <h3>5단계: 연결 확인</h3>
        <p>
          Claude Code에서 /mcp 명령으로 MCP 서버를 확인하세요.
          persona_list 도구를 호출하여 페르소나 목록이 조회되면 설정 완료입니다.
          chat 도구로 persona_id와 message를 전달하여 페르소나와 대화할 수 있습니다.
        </p>
        <h3>사용 가능한 MCP 도구</h3>
        <ul>
          <li>persona_list — API 키에 연결된 페르소나 목록 조회 (파라미터 없음)</li>
          <li>persona_create — 새 페르소나 생성 (name: 필수, domain/description/style: 선택)</li>
          <li>interview — 인터뷰로 페르소나 구축. 9개 질문으로 전문가의 판단 체계를 구조화 (persona_id, action: start/answer, session_id, answer)</li>
          <li>upload_audio — 음성 파일 업로드로 지식 임베딩 (persona_id, file_path: 로컬 파일 경로)</li>
          <li>chat — 페르소나와 대화 (persona_id: UUID, message: string)</li>
          <li>store_search — 스토어에서 전문가 페르소나 검색 (query: 검색어, category: 카테고리)</li>
          <li>store_preview — 스토어 페르소나 시식/체험. 페르소나당 2회 무료 (listing_id, message)</li>
          <li>my_purchased_personas — 구매한 페르소나 목록 조회 (파라미터 없음)</li>
          <li>consult_judgment — 전문가의 판단 프레임워크 기반 상황 자문 (persona_id, situation)</li>
          <li>get_framework — 전문가의 판단 프레임워크 조회 (persona_id)</li>
          <li>find_similar_story — 유사 경험 스토리 검색 (persona_id, query)</li>
          <li>compare_approaches — 두 접근법 전문가 관점 비교 (persona_id, approach_a, approach_b, context)</li>
        </ul>
        <h3>페르소나 스토어</h3>
        <p>
          전문가가 자신의 AI 페르소나를 스토어에 등록하여 판매할 수 있습니다.
          구매자는 스토어에서 원하는 전문가를 검색하고, 2회 무료 시식 후 구매할 수 있습니다.
          구매한 페르소나는 내 목록에 추가되어 chat 도구로 무제한 대화가 가능합니다.
          MCP에서의 워크플로우:
          1. store_search로 원하는 분야의 전문가 페르소나를 검색합니다.
          2. store_preview로 2회 무료 시식(체험)합니다.
          3. 웹에서 구매 후 my_purchased_personas로 확인합니다.
          4. chat 도구로 구매한 페르소나와 무제한 대화합니다.
        </p>
        <h3>페르소나가 없을 때</h3>
        <p>
          페르소나가 없으면 대화할 수 없습니다. 아래 순서로 안내하세요:
          1. persona_create로 페르소나를 생성합니다.
          2. interview로 9개 질문 인터뷰를 진행하여 전문가의 판단 체계를 구조화합니다.
          3. upload_audio로 음성 파일을 업로드하여 추가 지식을 임베딩합니다.
          4. chat으로 완성된 페르소나와 대화합니다.
          또는 store_search로 다른 전문가의 페르소나를 검색하여 구매할 수도 있습니다.
          인터뷰와 음성 업로드는 선택사항이지만, 진행할수록 페르소나의 답변 품질이 높아집니다.
        </p>
        <h3>REST API (MCP 없이 직접 호출)</h3>
        <ul>
          <li>GET /api/external/personas — 페르소나 목록 (헤더: x-api-key)</li>
          <li>POST /api/external/personas/create — 페르소나 생성 (헤더: x-api-key, 바디: name, domain, description, style)</li>
          <li>POST /api/external/interview — 인터뷰 진행 (헤더: x-api-key, 바디: persona_id, action, session_id, answer)</li>
          <li>POST /api/external/upload — 음성 파일 업로드 (헤더: x-api-key, FormData: file, persona_id)</li>
          <li>POST /api/external/chat — 대화 (헤더: x-api-key, 바디: persona_id, message)</li>
          <li>GET /api/external/store — 스토어 검색 (헤더: x-api-key, 쿼리: q, category, sort)</li>
          <li>POST /api/external/store/[id]/trial — 스토어 시식 (헤더: x-api-key, 바디: message)</li>
          <li>GET /api/external/purchases — 구매 목록 (헤더: x-api-key)</li>
          <li>POST /api/external/consult — 판단 자문 (헤더: x-api-key, 바디: persona_id, situation)</li>
          <li>GET /api/external/framework — 판단 프레임워크 조회 (헤더: x-api-key, 쿼리: persona_id)</li>
          <li>POST /api/external/stories — 유사 경험 검색 (헤더: x-api-key, 바디: persona_id, query)</li>
          <li>POST /api/external/compare — 접근법 비교 (헤더: x-api-key, 바디: persona_id, approach_a, approach_b, context)</li>
        </ul>
      </div>
    </main>
  );
}
