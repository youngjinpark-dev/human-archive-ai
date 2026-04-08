"use client";

import PersonaCard from "@/components/persona-card";
import type { Persona } from "@/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/personas")
      .then((r) => r.json())
      .then((data) => {
        setPersonas(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-white">페르소나</h1>
        <Link
          href="/personas/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + 새 페르소나
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-500 dark:text-slate-400">로딩 중...</p>
      ) : personas.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <p className="text-lg">아직 페르소나가 없습니다.</p>
          <p className="mt-1">전문가의 지식을 아카이빙해 보세요.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((p) => (
            <PersonaCard key={p.id} persona={p} />
          ))}
        </div>
      )}
    </div>
  );
}
