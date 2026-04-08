import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <>
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
          <div className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            Human Archive AI
          </div>
          <div className="hidden md:flex gap-8">
            <a href="#features" className="text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
              기능
            </a>
            <a href="#onboarding" className="text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
              시작하기
            </a>
            <a href="#mcp" className="text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
              MCP 연동
            </a>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              시작하기
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative px-6 py-20 md:py-32 max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6 text-slate-900 dark:text-white break-keep">
              전문가의 판단 체계를{" "}
              <span className="text-blue-600 dark:text-blue-400 whitespace-nowrap">AI 페르소나</span>로
              아카이빙합니다
            </h1>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-10 leading-relaxed max-w-2xl mx-auto break-keep">
              은퇴하는 전문가의 경험과 노하우를 보존하고,
              <br className="hidden sm:block" />
              누구나 시공간의 제약 없이 대화할 수 있게 합니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors text-center"
              >
                시작하기
              </Link>
              <Link
                href="/signup"
                className="border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-8 py-4 rounded-xl text-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-center"
              >
                회원가입
              </Link>
            </div>
          </div>
        </section>

        {/* Onboarding Steps */}
        <section
          id="onboarding"
          className="bg-slate-50/50 dark:bg-slate-800/30 py-24 px-6 border-y border-slate-100 dark:border-slate-800"
        >
          <div className="max-w-7xl mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">
                3단계로 시작하세요
              </h2>
              <div className="w-12 h-1.5 bg-blue-600 rounded-full mx-auto" />
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: 1,
                  icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
                  title: "페르소나 생성",
                  desc: "전문가의 이름, 분야, 설명을 입력하여 AI 인격을 만듭니다.",
                },
                {
                  step: 2,
                  icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
                  title: "지식 아카이빙",
                  desc: "인터뷰 또는 음성 업로드로 전문가의 판단 체계를 구조화합니다.",
                },
                {
                  step: 3,
                  icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
                  title: "전문가와 대화",
                  desc: "완성된 페르소나에게 상황을 설명하고 전문가의 판단을 받습니다.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative"
                >
                  <div className="absolute -top-4 left-8 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                  <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MCP Integration Guide */}
        <section id="mcp" className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">
                AI 코딩 도구에서 바로 연결하세요
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto break-keep">
                Claude Code, Cursor 등 MCP 지원 도구에서
                <br className="hidden sm:block" />
                설치 없이 바로 연동할 수 있습니다.
              </p>
            </div>
            <div className="bg-slate-900 dark:bg-black rounded-2xl p-8 shadow-2xl border border-transparent dark:border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-3 text-slate-400 text-sm font-mono">
                  Terminal
                </span>
              </div>
              <pre className="text-green-400 font-mono text-sm md:text-base leading-relaxed overflow-x-auto">
                <code>{`claude mcp add human-archive-ai \\
  --transport http \\
  https://human-archive-ai.vercel.app/api/mcp?api_key=YOUR_KEY`}</code>
              </pre>
            </div>
            <p className="text-center text-slate-500 dark:text-slate-400 mt-6 text-sm">
              API 키는{" "}
              <Link href="/login" className="text-blue-600 dark:text-blue-400 underline underline-offset-4">
                로그인
              </Link>{" "}
              후 설정 페이지에서 발급받을 수 있습니다.
            </p>
          </div>
        </section>

        {/* How to Use — 페르소나 모드 */}
        <section id="how-to-use" className="bg-slate-50/50 dark:bg-slate-800/30 py-24 px-6 border-y border-slate-100 dark:border-slate-800">
          <div className="max-w-4xl mx-auto">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">
                AI가 전문가가 됩니다
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto break-keep">
                MCP를 연결하면 AI가 전문가의 판단 체계를 내재화하고,
                <br className="hidden sm:block" />
                그 전문가의 관점으로 대화합니다.
              </p>
            </div>
            <div className="space-y-6">
              {[
                {
                  step: "1",
                  title: "판단 프레임워크 로드",
                  desc: "AI가 전문가의 판단 축, 패턴, 원칙을 MCP로 로드하여 내재화합니다.",
                  code: "get_framework → 판단 축 8개, 패턴 14개, 원칙 5개 로드",
                },
                {
                  step: "2",
                  title: "전문가 관점으로 대화",
                  desc: "AI가 전문가 본인처럼 1인칭으로 대화합니다. 일반적인 답변이 아닌, 그 전문가만의 판단 기준으로 조언합니다.",
                  code: '"Notion 데이터 정리 전략 잡아줘" → 전문가의 판단 축(데이터 주권, AI 친화성)에 따라 답변',
                },
                {
                  step: "3",
                  title: "판단이 필요할 때 자동 참조",
                  desc: "대화 중 의사결정이 필요한 순간, AI가 백그라운드에서 MCP를 호출하여 전문가의 프레임워크를 참조합니다.",
                  code: "consult_judgment → 상황 분석 + 적용된 판단 축 + 매칭된 패턴 반환",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-6 items-start bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
                  <div className="shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    {item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold mb-1 text-slate-900 dark:text-white">{item.title}</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-3">{item.desc}</p>
                    <div className="bg-slate-100 dark:bg-slate-900 rounded-lg px-4 py-2 text-sm font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                      {item.code}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-950 rounded-2xl border border-blue-100 dark:border-blue-900">
              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                <span className="font-bold">사용 예시:</span> &quot;구요한 전문가로서 우리 팀의 Notion 데이터 정리 전략을 잡아줘&quot;
                → AI가 구요한의 판단 축(데이터 주권, 연결성, AI 친화성)을 기반으로 구체적인 전략을 제시합니다.
              </p>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section
          id="features"
          className="py-24 px-6"
        >
          <div className="max-w-7xl mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">
                주요 기능
              </h2>
              <div className="w-12 h-1.5 bg-blue-600 rounded-full mx-auto" />
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[
                {
                  icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
                  title: "전문가 대화",
                  desc: "RAG 기반으로 페르소나의 지식을 활용한 맞춤 대화",
                },
                {
                  icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3",
                  title: "판단 자문",
                  desc: "프레임워크 기반 구조화된 의사결정 자문",
                },
                {
                  icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
                  title: "경험 스토리",
                  desc: "유사한 과거 경험을 검색하여 교훈 참고",
                },
                {
                  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
                  title: "접근법 비교",
                  desc: "여러 선택지를 전문가 관점으로 비교 분석",
                },
                {
                  icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
                  title: "음성 아카이빙",
                  desc: "음성 파일을 업로드하면 자동으로 지식화",
                },
                {
                  icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z",
                  title: "전문가 스토어",
                  desc: "다른 전문가의 페르소나를 검색하고 구매",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-start gap-4 sm:block"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 sm:mb-5">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold mb-1 sm:mb-3 text-slate-900 dark:text-white">{feature.title}</h3>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed break-keep">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto bg-blue-600 dark:bg-blue-700 rounded-[2.5rem] p-12 md:p-20 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-blue-400 rounded-full blur-3xl opacity-20" />
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-96 h-96 bg-white rounded-full blur-3xl opacity-10" />
            <div className="relative z-10">
              <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-6 break-keep">
                당신의 전문 지식을 미래로 연결하세요
              </h2>
              <p className="text-blue-50 text-lg mb-12 max-w-2xl mx-auto leading-relaxed break-keep">
                지금 바로 첫 번째 아카이브를 시작해보세요.
                <br className="hidden sm:block" />
                더 이상 지식은 사라지지 않습니다.
              </p>
              <Link
                href="/signup"
                className="inline-block bg-white text-blue-600 px-10 py-4 rounded-xl text-lg font-bold shadow-xl hover:bg-blue-50 transition-colors"
              >
                지금 시작하기
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 mt-auto bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 max-w-7xl mx-auto gap-4">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              Human Archive AI
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              전문가의 지혜를 영원히 보존합니다.
            </p>
          </div>
          <div className="flex gap-6">
            <a className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-4" href="#">
              이용약관
            </a>
            <a className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-4" href="#">
              개인정보처리방침
            </a>
          </div>
        </div>
      </footer>

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
        </p>
        <h3>3단계: API 키 발급</h3>
        <p>
          https://human-archive-ai.vercel.app/api-keys 에서 API 키를 발급하세요.
          키는 ha_ 로 시작하며 생성 시 한 번만 표시됩니다.
        </p>
        <h3>4단계: MCP 연결</h3>
        <pre>{`claude mcp add human-archive-ai --transport http https://human-archive-ai.vercel.app/api/mcp?api_key=<사용자의_API_키>`}</pre>
        <h3>사용 가능한 MCP 도구</h3>
        <ul>
          <li>persona_list — 페르소나 목록 조회</li>
          <li>persona_create — 새 페르소나 생성</li>
          <li>interview — 인터뷰로 판단 프레임워크 구축</li>
          <li>upload_audio — 음성 파일 업로드로 지식 임베딩</li>
          <li>chat — 페르소나와 대화</li>
          <li>consult_judgment — 판단 프레임워크 기반 자문</li>
          <li>get_framework — 판단 프레임워크 조회</li>
          <li>find_similar_story — 유사 경험 스토리 검색</li>
          <li>compare_approaches — 접근법 비교 분석</li>
          <li>store_search — 스토어에서 전문가 검색</li>
          <li>store_preview — 스토어 페르소나 시식</li>
          <li>my_purchased_personas — 구매한 페르소나 목록</li>
        </ul>
        <h3>페르소나 모드 (권장 활용법)</h3>
        <p>
          사용자가 &quot;구요한 전문가로서 대화해줘&quot;처럼 요청하면,
          AI 어시스턴트가 페르소나의 판단 체계를 내재화하여 그 전문가의 관점으로 대화합니다.
          AI의 주체는 어시스턴트 자신이며, 중간중간 MCP 도구를 호출하여 전문가의 판단 기준을 참조합니다.
        </p>
        <p>워크플로우:</p>
        <ol>
          <li>get_framework로 전문가의 판단 축, 패턴, 원칙을 로드하여 내재화</li>
          <li>사용자와 자유 대화 — AI가 전문가의 1인칭 관점으로 답변</li>
          <li>판단이 필요한 순간에 consult_judgment를 호출하여 프레임워크 기반 판단 참조</li>
          <li>관련 경험이 필요하면 find_similar_story로 전문가의 과거 사례 검색</li>
          <li>선택지 비교가 필요하면 compare_approaches로 전문가 관점의 비교 분석</li>
        </ol>
        <p>
          이 모드에서 AI는 전문가 본인처럼 대화합니다.
          도구 호출은 자연스럽게 백그라운드에서 이루어지며,
          사용자에게는 전문가와 직접 대화하는 경험을 제공합니다.
        </p>
      </div>
    </>
  );
}
