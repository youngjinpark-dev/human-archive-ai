"use client";

import type { FileUpload } from "@/types";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export default function FilesPage() {
  const { id } = useParams<{ id: string }>();
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
  }, [id]);

  async function loadFiles() {
    const res = await fetch(`/api/personas/${id}`);
    if (!res.ok) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("file_uploads")
      .select("*")
      .eq("persona_id", id)
      .order("created_at", { ascending: false });
    setFiles(data ?? []);
  }

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 파일명 sanitize — UUID + 확장자
      const ext = file.name.split(".").pop() || "mp3";
      const safeFileName = `${crypto.randomUUID()}.${ext}`;
      const filePath = `${user.id}/${id}/${safeFileName}`;

      // 1. 클라이언트에서 Supabase Storage에 직접 업로드 (용량 제한 없음)
      const { error: storageError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file);

      if (storageError) {
        alert(`업로드 실패: ${storageError.message}`);
        return;
      }

      // 2. DB 레코드 생성
      const { data: upload, error: dbError } = await supabase
        .from("file_uploads")
        .insert({
          persona_id: id,
          file_name: file.name,
          file_path: filePath,
          status: "uploaded",
        })
        .select()
        .single();

      if (dbError || !upload) {
        alert(`DB 오류: ${dbError?.message}`);
        return;
      }

      // 3. 처리 시작
      processFile(upload.id);
      await loadFiles();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [id]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !uploading) uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function processFile(fileId: string) {
    // 처리를 fire-and-forget으로 시작
    fetch(`/api/files/${fileId}/process`, { method: "POST" }).then(() => loadFiles());

    // 처리 중 상태를 폴링으로 반영
    const poll = setInterval(async () => {
      await loadFiles();
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("file_uploads")
        .select("status")
        .eq("id", fileId)
        .single();
      if (data && (data.status === "done" || data.status === "error")) {
        clearInterval(poll);
      }
    }, 3000);
  }

  const statusLabel: Record<string, string> = {
    uploaded: "업로드됨",
    transcribing: "음성 변환 중... (1~5분 소요)",
    embedding: "임베딩 중... (곧 완료됩니다)",
    done: "완료",
    error: "오류",
  };

  const statusColor: Record<string, string> = {
    uploaded: "text-gray-500 dark:text-gray-400",
    transcribing: "text-yellow-600 dark:text-yellow-400",
    embedding: "text-blue-600 dark:text-blue-400",
    done: "text-green-600 dark:text-green-400",
    error: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">파일 관리</h1>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-slate-300 dark:border-slate-600"
        }`}
      >
        <p className="text-slate-500 dark:text-slate-400 mb-3">
          녹음 파일 또는 영상을 드래그하거나 선택하세요
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
          mp3, mp4, m4a, wav, webm 지원
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition"
        >
          {uploading ? "업로드 중..." : "파일 선택"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          onChange={handleInputChange}
          disabled={uploading}
          className="sr-only"
        />
      </div>

      {files.length === 0 ? (
        <p className="text-center text-slate-400 dark:text-slate-500">업로드된 파일이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800"
            >
              <div>
                <p className="font-medium text-sm dark:text-slate-200">{f.file_name}</p>
                <p className={`text-xs mt-1 ${statusColor[f.status]}`}>
                  {statusLabel[f.status]}
                </p>
              </div>
              <div className="flex gap-3">
                {f.status === "uploaded" && (
                  <button
                    onClick={() => processFile(f.id)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    처리 시작
                  </button>
                )}
                {(f.status === "done" || f.status === "error") && (
                  <button
                    onClick={() => processFile(f.id)}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:underline"
                  >
                    재처리
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
