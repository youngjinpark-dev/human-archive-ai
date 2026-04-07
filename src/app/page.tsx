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
    </main>
  );
}
