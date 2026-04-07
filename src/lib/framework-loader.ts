import { createServiceClient } from "@/lib/supabase/server";
import type { FrameworkData } from "@/types";

/**
 * 페르소나의 판단 프레임워크 + axes + patterns를 로드한다.
 * 프레임워크가 없으면 null을 반환한다.
 */
export async function loadFramework(
  personaId: string
): Promise<FrameworkData | null> {
  const supabase = createServiceClient();

  const { data: framework } = await supabase
    .from("judgment_frameworks")
    .select("*")
    .eq("persona_id", personaId)
    .single();

  if (!framework) return null;

  const [{ data: axes }, { data: patterns }] = await Promise.all([
    supabase
      .from("judgment_axes")
      .select("*")
      .eq("framework_id", framework.id)
      .order("weight", { ascending: false }),
    supabase
      .from("if_then_patterns")
      .select("*")
      .eq("framework_id", framework.id)
      .order("confidence", { ascending: false }),
  ]);

  return {
    framework,
    axes: axes ?? [],
    patterns: patterns ?? [],
  };
}
