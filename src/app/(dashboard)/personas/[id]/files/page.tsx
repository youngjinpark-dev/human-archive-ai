"use client";

import type { FileUpload } from "@/types";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function FilesPage() {
  const { id } = useParams<{ id: string }>();
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
  }, [id]);

  async function loadFiles() {
    const res = await fetch(`/api/personas/${id}`);
    if (!res.ok) return;
    // 파일 목록은 별도 API 없이 persona 페이지에서 fetch
    // 간단히 file_uploads 테이블 직접 조회 (클라이언트에서 supabase 사용)
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("file_uploads")
      .select("*")
      .eq("persona_id", id)
      .order("created_at", { ascending: false });
    setFiles(data ?? []);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("persona_id", id);

    const res = await fetch("/api/files/upload", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const upload = await res.json();
      // 자동으로 STT + 임베딩 처리 시작
      processFile(upload.id);
      await loadFiles();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function processFile(fileId: string) {
    await fetch(`/api/files/${fileId}/process`, { method: "POST" });
    await loadFiles();
  }

  const statusLabel: Record<string, string> = {
    uploaded: "업로드됨",
    transcribing: "변환 중...",
    embedding: "임베딩 중...",
    done: "완료",
    error: "오류",
  };

  const statusColor: Record<string, string> = {
    uploaded: "text-gray-500",
    transcribing: "text-yellow-600",
    embedding: "text-blue-600",
    done: "text-green-600",
    error: "text-red-600",
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">파일 관리</h1>

      <div className="border-2 border-dashed rounded-lg p-8 text-center mb-6">
        <p className="text-gray-500 mb-3">
          녹음 파일 또는 영상을 업로드하세요
        </p>
        <p className="text-xs text-gray-400 mb-4">
          mp3, mp4, m4a, wav, webm 지원
        </p>
        <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer transition">
          {uploading ? "업로드 중..." : "파일 선택"}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {files.length === 0 ? (
        <p className="text-center text-gray-400">업로드된 파일이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between border rounded-lg p-4"
            >
              <div>
                <p className="font-medium text-sm">{f.file_name}</p>
                <p className={`text-xs mt-1 ${statusColor[f.status]}`}>
                  {statusLabel[f.status]}
                </p>
              </div>
              {f.status === "uploaded" && (
                <button
                  onClick={() => processFile(f.id)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  처리 시작
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
