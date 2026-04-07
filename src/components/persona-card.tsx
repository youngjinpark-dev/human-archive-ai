import type { Persona } from "@/types";
import Link from "next/link";

export default function PersonaCard({ persona }: { persona: Persona }) {
  return (
    <Link
      href={`/personas/${persona.id}`}
      className="block border rounded-lg p-5 hover:border-blue-300 hover:shadow-sm transition"
    >
      <h3 className="font-semibold text-lg">{persona.name}</h3>
      {persona.domain && (
        <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
          {persona.domain}
        </span>
      )}
      {persona.description && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-2">
          {persona.description}
        </p>
      )}
      <div className="mt-3 flex gap-3 text-xs text-gray-400">
        <span>원칙 {persona.principles?.length ?? 0}개</span>
        <span>시나리오 {persona.decision_scenarios?.length ?? 0}개</span>
      </div>
    </Link>
  );
}
