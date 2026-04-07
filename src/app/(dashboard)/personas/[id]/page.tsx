"use client";

import type { Persona } from "@/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PersonaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/personas/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setPersona)
      .catch(() => router.push("/personas"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleDelete() {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/personas/${id}`, { method: "DELETE" });
    router.push("/personas");
  }

  if (loading) return <p className="text-gray-500">로딩 중...</p>;
  if (!persona) return null;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{persona.name}</h1>
          {persona.domain && (
            <span className="inline-block mt-1 text-sm bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
              {persona.domain}
            </span>
          )}
          {persona.description && (
            <p className="mt-2 text-gray-600">{persona.description}</p>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="text-sm text-red-500 hover:text-red-700"
        >
          삭제
        </button>
      </div>

      {/* 액션 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Link
          href={`/personas/${id}/interview`}
          className="border rounded-lg p-5 hover:border-blue-300 transition text-center"
        >
          <div className="text-2xl mb-2">🎤</div>
          <h3 className="font-medium">인터뷰</h3>
          <p className="text-sm text-gray-500 mt-1">
            판단 체계를 추출합니다
          </p>
        </Link>
        <Link
          href={`/personas/${id}/chat`}
          className="border rounded-lg p-5 hover:border-blue-300 transition text-center"
        >
          <div className="text-2xl mb-2">💬</div>
          <h3 className="font-medium">채팅</h3>
          <p className="text-sm text-gray-500 mt-1">
            페르소나와 대화합니다
          </p>
        </Link>
        <Link
          href={`/personas/${id}/files`}
          className="border rounded-lg p-5 hover:border-blue-300 transition text-center"
        >
          <div className="text-2xl mb-2">📁</div>
          <h3 className="font-medium">파일 관리</h3>
          <p className="text-sm text-gray-500 mt-1">
            녹음/영상 파일을 업로드합니다
          </p>
        </Link>
        <Link
          href={`/personas/${id}/publish`}
          className="border rounded-lg p-5 hover:border-blue-300 transition text-center"
        >
          <div className="text-2xl mb-2">🏪</div>
          <h3 className="font-medium">스토어 등록</h3>
          <p className="text-sm text-gray-500 mt-1">
            스토어에 판매 등록합니다
          </p>
        </Link>
      </div>

      {/* 페르소나 상세 */}
      <div className="space-y-6">
        {persona.principles && persona.principles.length > 0 && (
          <section>
            <h2 className="font-semibold text-lg mb-2">핵심 판단 원칙</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              {persona.principles.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>
        )}

        {persona.decision_scenarios && persona.decision_scenarios.length > 0 && (
          <section>
            <h2 className="font-semibold text-lg mb-2">의사결정 시나리오</h2>
            <div className="space-y-3">
              {persona.decision_scenarios.map((ds, i) => (
                <div key={i} className="border rounded-lg p-4 bg-gray-50">
                  <p className="font-medium">상황: {ds.situation}</p>
                  <p className="text-gray-700 mt-1">→ 판단: {ds.decision}</p>
                  {ds.reasoning && (
                    <p className="text-gray-500 text-sm mt-1">
                      근거: {ds.reasoning}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {persona.style && (
          <section>
            <h2 className="font-semibold text-lg mb-2">대화 스타일</h2>
            <p className="text-gray-700">{persona.style}</p>
          </section>
        )}
      </div>
    </div>
  );
}
