"use client";

import { STORE_CATEGORIES } from "@/lib/store-constants";
import type { Persona } from "@/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface QualityGate {
  interviewDone: boolean;
  hasKnowledge: boolean;
  principlesCount: number;
  scenariosCount: number;
}

export default function PublishPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    fetch(`/api/personas/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((p: Persona) => {
        setPersona(p);
        setTitle(p.name);
        setDescription(p.description ?? "");
        if (p.domain) setCategory(p.domain);
      })
      .catch(() => router.push("/personas"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <p className="text-slate-500 dark:text-slate-400">로딩 중...</p>;
  if (!persona) return null;

  const quality: QualityGate = {
    interviewDone:
      (persona.principles?.length ?? 0) > 0 ||
      (persona.decision_scenarios?.length ?? 0) > 0,
    hasKnowledge: true,
    principlesCount: persona.principles?.length ?? 0,
    scenariosCount: persona.decision_scenarios?.length ?? 0,
  };

  const qualityMet =
    quality.interviewDone &&
    quality.principlesCount >= 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qualityMet || submitting) return;

    setSubmitting(true);
    setError(null);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/store/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_id: id,
          title,
          subtitle: subtitle || null,
          description,
          category,
          tags,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "등록 중 오류가 발생했습니다.");
        setSubmitting(false);
        return;
      }

      router.push(`/store/${data.id}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link href={`/personas/${id}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">&larr; 페르소나 상세</Link>
      <h1 className="text-2xl font-bold mb-6 dark:text-white">스토어에 등록하기</h1>

      {/* Quality Gate Checklist */}
      <div className="border dark:border-slate-700 rounded-lg p-4 mb-6 dark:bg-slate-900">
        <h2 className="font-semibold mb-3 dark:text-white">품질 체크리스트</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span>{quality.interviewDone ? "✅" : "❌"}</span>
            인터뷰 완료
          </li>
          <li className="flex items-center gap-2">
            <span>{quality.hasKnowledge ? "✅" : "❌"}</span>
            지식 소스 존재
          </li>
          <li className="flex items-center gap-2">
            <span>{quality.principlesCount >= 1 ? "✅" : "❌"}</span>
            판단 원칙 {quality.principlesCount}개{" "}
            {quality.principlesCount < 1 && "(최소 1개 필요)"}
          </li>
          <li className="flex items-center gap-2">
            <span>{quality.scenariosCount >= 1 ? "✅" : "❌"}</span>
            의사결정 시나리오 {quality.scenariosCount}개{" "}
            {quality.scenariosCount < 1 && "(최소 1개 필요)"}
          </li>
        </ul>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            부제목
          </label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            설명
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:bg-slate-800 dark:text-white resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            카테고리
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:bg-slate-800 dark:text-white"
          >
            <option value="">선택하세요</option>
            {STORE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            태그 (쉼표로 구분)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="예: AI, 개발, 멘토링"
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:bg-slate-800 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={!qualityMet || submitting}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {submitting ? "등록 중..." : "스토어에 등록하기"}
        </button>

        {!qualityMet && (
          <p className="text-sm text-amber-600 text-center">
            품질 체크리스트를 모두 충족해야 등록할 수 있습니다.
          </p>
        )}
      </form>
    </div>
  );
}
