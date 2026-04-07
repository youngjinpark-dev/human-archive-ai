import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/files/upload — 파일 업로드
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const personaId = formData.get("persona_id") as string | null;

  if (!file || !personaId) {
    return NextResponse.json(
      { error: "file and persona_id required" },
      { status: 400 }
    );
  }

  // 페르소나 소유 확인
  const { data: persona } = await supabase
    .from("personas")
    .select("id")
    .eq("id", personaId)
    .eq("user_id", user.id)
    .single();
  if (!persona) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 파일명 sanitize — UUID + 확장자 (특수문자 문제 방지)
  const ext = (file.name || "audio.mp3").split(".").pop() || "mp3";
  const safeFileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = `${user.id}/${personaId}/${safeFileName}`;
  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(filePath, file);

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // DB에 레코드 생성
  const { data: upload, error } = await supabase
    .from("file_uploads")
    .insert({
      persona_id: personaId,
      file_name: file.name,
      file_path: filePath,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(upload, { status: 201 });
}
