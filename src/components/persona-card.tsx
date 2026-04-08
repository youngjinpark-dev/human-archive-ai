import type { Persona } from "@/types";
import Link from "next/link";

export default function PersonaCard({ persona }: { persona: Persona }) {
  return (
    <Link
      href={`/personas/${persona.id}`}
      className="block border border-slate-200 dark:border-slate-700 rounded-lg p-5 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-sm transition bg-white dark:bg-slate-800"
    >
      <h3 className="font-semibold text-lg dark:text-white">{persona.name}</h3>
      {persona.domain && (
        <span className="inline-block mt-1 text-xs bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
          {persona.domain}
        </span>
      )}
      {persona.description && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
          {persona.description}
        </p>
      )}
      <div className="mt-3 flex gap-3 text-xs text-slate-400 dark:text-slate-500">
        <span>원칙 {persona.principles?.length ?? 0}개</span>
        <span>시나리오 {persona.decision_scenarios?.length ?? 0}개</span>
      </div>
    </Link>
  );
}
