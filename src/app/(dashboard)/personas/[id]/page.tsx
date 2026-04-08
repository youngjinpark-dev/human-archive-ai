"use client";

import type { Persona, FileUpload } from "@/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface FrameworkAxis {
  name: string;
  description: string;
  weight: number;
}

interface FrameworkPattern {
  condition: string;
  action: string;
  reasoning?: string;
}

interface KnowledgeStats {
  chunks: number;
  files: FileUpload[];
  axes: FrameworkAxis[];
  patterns: FrameworkPattern[];
  frameworkStatus: string | null;
}

export default function PersonaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const router = useRouter();

  const reloadPersona = useCallback(() => {
    fetch(`/api/personas/${id}`).then((r) => r.ok ? r.json() : null).then((d) => d && setPersona(d));
  }, [id]);

  async function regenerate(items: string[]) {
    setRegenerating(new Set(items));
    try {
      await fetch(`/api/personas/${id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      reloadPersona();
      // 프레임워크도 리로드
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const { data: fw } = await sb.from("judgment_frameworks").select("id, status").eq("persona_id", id).single();
      if (fw) {
        const [{ data: ax }, { data: pt }] = await Promise.all([
          sb.from("judgment_axes").select("name, description, weight").eq("framework_id", fw.id).order("weight", { ascending: false }),
          sb.from("if_then_patterns").select("condition, action, reasoning").eq("framework_id", fw.id),
        ]);
        setKnowledge((prev) => prev ? { ...prev, axes: ax ?? [], patterns: pt ?? [], frameworkStatus: fw.status } : prev);
      }
    } finally {
      setRegenerating(new Set());
    }
  }

  useEffect(() => {
    fetch(`/api/personas/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setPersona)
      .catch(() => router.push("/personas"))
      .finally(() => setLoading(false));

    // 지식 현황 + 프레임워크 로드
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const [{ count }, { data: files }, { data: framework }] = await Promise.all([
        supabase.from("chunks").select("*", { count: "exact", head: true }).eq("persona_id", id),
        supabase.from("file_uploads").select("*").eq("persona_id", id).order("created_at", { ascending: false }),
        supabase.from("judgment_frameworks").select("id, status").eq("persona_id", id).single(),
      ]);

      let axes: FrameworkAxis[] = [];
      let patterns: FrameworkPattern[] = [];
      if (framework) {
        const [{ data: axesData }, { data: patternsData }] = await Promise.all([
          supabase.from("judgment_axes").select("name, description, weight").eq("framework_id", framework.id).order("weight", { ascending: false }),
          supabase.from("if_then_patterns").select("condition, action, reasoning").eq("framework_id", framework.id),
        ]);
        axes = axesData ?? [];
        patterns = patternsData ?? [];
      }

      setKnowledge({
        chunks: count ?? 0,
        files: files ?? [],
        axes,
        patterns,
        frameworkStatus: framework?.status ?? null,
      });
    })();
  }, [id, router]);

  async function handleDelete() {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/personas/${id}`, { method: "DELETE" });
    router.push("/personas");
  }

  if (loading) return <p className="text-slate-500 dark:text-slate-400">로딩 중...</p>;
  if (!persona) return null;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold dark:text-white">{persona.name}</h1>
          {persona.domain && (
            <span className="inline-block mt-1 text-sm bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
              {persona.domain}
            </span>
          )}
          {persona.description && (
            <p className="mt-2 text-slate-600 dark:text-slate-300">{persona.description}</p>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="text-sm text-red-500 hover:text-red-700 whitespace-nowrap shrink-0"
        >
          삭제
        </button>
      </div>

      {/* 액션 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Link
          href={`/personas/${id}/interview`}
          className="border border-slate-200 dark:border-slate-700 rounded-lg p-5 hover:border-blue-300 dark:hover:border-blue-500 transition text-center bg-white dark:bg-slate-800"
        >
          <div className="text-2xl mb-2">🎤</div>
          <h3 className="font-medium">인터뷰</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            판단 체계를 추출합니다
          </p>
        </Link>
        <Link
          href={`/personas/${id}/chat`}
          className="border border-slate-200 dark:border-slate-700 rounded-lg p-5 hover:border-blue-300 dark:hover:border-blue-500 transition text-center bg-white dark:bg-slate-800"
        >
          <div className="text-2xl mb-2">💬</div>
          <h3 className="font-medium">채팅</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            페르소나와 대화합니다
          </p>
        </Link>
        <Link
          href={`/personas/${id}/files`}
          className="border border-slate-200 dark:border-slate-700 rounded-lg p-5 hover:border-blue-300 dark:hover:border-blue-500 transition text-center bg-white dark:bg-slate-800"
        >
          <div className="text-2xl mb-2">📁</div>
          <h3 className="font-medium">파일 관리</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            녹음/영상 파일을 업로드합니다
          </p>
        </Link>
        <Link
          href={`/personas/${id}/publish`}
          className="border border-slate-200 dark:border-slate-700 rounded-lg p-5 hover:border-blue-300 dark:hover:border-blue-500 transition text-center bg-white dark:bg-slate-800"
        >
          <div className="text-2xl mb-2">🏪</div>
          <h3 className="font-medium">스토어 등록</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            스토어에 판매 등록합니다
          </p>
        </Link>
      </div>

      {/* 아카이빙된 지식 현황 */}
      {knowledge && (knowledge.chunks > 0 || knowledge.files.length > 0) && (
        <div className="mb-8 border dark:border-slate-700 rounded-lg p-6 bg-slate-50 dark:bg-slate-800">
          <h2 className="font-semibold text-lg mb-4 dark:text-white">아카이빙된 지식</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{knowledge.chunks}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">지식 청크</p>
            </div>
            <div className="text-center p-3 bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{knowledge.files.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">업로드 파일</p>
            </div>
          </div>
          {knowledge.files.length > 0 && (
            <div className="space-y-2">
              {knowledge.files.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300 truncate max-w-xs">{f.file_name}</span>
                  <span className={`text-xs ${
                    f.status === "done" ? "text-green-600 dark:text-green-400" :
                    f.status === "error" ? "text-red-600 dark:text-red-400" :
                    "text-yellow-600 dark:text-yellow-400"
                  }`}>
                    {f.status === "done" ? "완료" : f.status === "error" ? "오류" : "처리 중..."}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 미생성 항목 재생성 버튼 */}
      {knowledge && knowledge.files.length > 0 && (
        (() => {
          const missing: { key: string; label: string }[] = [];
          if (!persona.principles || persona.principles.length === 0) missing.push({ key: "principles", label: "판단 원칙" });
          if (!persona.decision_scenarios || persona.decision_scenarios.length === 0) missing.push({ key: "scenarios", label: "의사결정 시나리오" });
          if (!persona.style) missing.push({ key: "style", label: "대화 스타일" });
          if (knowledge.axes.length === 0) missing.push({ key: "axes", label: "판단 축" });
          if (knowledge.patterns.length === 0) missing.push({ key: "patterns", label: "판단 패턴" });

          if (missing.length === 0) return null;

          return (
            <div className="mb-8 p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-950">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                아직 생성되지 않은 항목이 있습니다. 트랜스크립트에서 개별 추출할 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {missing.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => regenerate([m.key])}
                    disabled={regenerating.size > 0}
                    className="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition whitespace-nowrap"
                  >
                    {regenerating.has(m.key) ? `${m.label} 생성 중...` : `${m.label} 생성`}
                  </button>
                ))}
                {missing.length > 1 && (
                  <button
                    onClick={() => regenerate(missing.map((m) => m.key))}
                    disabled={regenerating.size > 0}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition whitespace-nowrap"
                  >
                    {regenerating.size > 0 ? "생성 중..." : "전체 생성"}
                  </button>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* 판단 프레임워크 (음성/인터뷰에서 추출) */}
      {knowledge && knowledge.axes.length > 0 && (
        <div className="mb-8 space-y-6">
          <section>
            <h2 className="font-semibold text-lg mb-3 dark:text-white">판단 축</h2>
            <div className="space-y-3">
              {knowledge.axes.map((a, i) => (
                <div key={i} className="border dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium dark:text-white">{a.name}</span>
                    <span className="text-xs text-blue-600 dark:text-blue-400">중요도 {a.weight}</span>
                  </div>
                  {a.description && <p className="text-sm text-slate-600 dark:text-slate-300">{a.description}</p>}
                </div>
              ))}
            </div>
          </section>

          {knowledge.patterns.length > 0 && (
            <section>
              <h2 className="font-semibold text-lg mb-3 dark:text-white">판단 패턴</h2>
              <div className="space-y-3">
                {knowledge.patterns.map((p, i) => (
                  <div key={i} className="border dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
                    <p className="font-medium text-sm dark:text-white">IF {p.condition}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">→ THEN {p.action}</p>
                    {p.reasoning && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">근거: {p.reasoning}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* 페르소나 상세 (인터뷰 classic 데이터) */}
      <div className="space-y-6">
        {persona.principles && persona.principles.length > 0 && (
          <section>
            <h2 className="font-semibold text-lg mb-2">핵심 판단 원칙</h2>
            <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
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
                <div key={i} className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                  <p className="font-medium">상황: {ds.situation}</p>
                  <p className="text-slate-700 dark:text-slate-300 mt-1">→ 판단: {ds.decision}</p>
                  {ds.reasoning && (
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
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
            <p className="text-slate-700 dark:text-slate-300">{persona.style}</p>
          </section>
        )}
      </div>
    </div>
  );
}
