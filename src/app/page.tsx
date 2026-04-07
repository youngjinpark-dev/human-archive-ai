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
        <h3>4단계: MCP 설정 파일 생성</h3>
        <p>
          프로젝트 루트에 .mcp.json 파일을 생성하세요.
          Claude Desktop의 경우 ~/Library/Application Support/Claude/claude_desktop_config.json (Mac)
          또는 %APPDATA%\Claude\claude_desktop_config.json (Windows)에 설정합니다.
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
          Claude Code에서 /mcp 명령으로 MCP 서버를 연결하세요.
          persona_list 도구를 호출하여 페르소나 목록이 조회되면 설정 완료입니다.
          chat 도구로 persona_id와 message를 전달하여 페르소나와 대화할 수 있습니다.
        </p>
        <h3>사용 가능한 MCP 도구</h3>
        <ul>
          <li>persona_list — API 키에 연결된 페르소나 목록 조회 (파라미터 없음)</li>
          <li>chat — 페르소나와 대화 (persona_id: UUID, message: string)</li>
        </ul>
        <h3>REST API (MCP 없이 직접 호출)</h3>
        <ul>
          <li>GET /api/external/personas — 페르소나 목록 (헤더: x-api-key)</li>
          <li>POST /api/external/chat — 대화 (헤더: x-api-key, 바디: persona_id, message)</li>
        </ul>
      </div>
    </main>
  );
}
