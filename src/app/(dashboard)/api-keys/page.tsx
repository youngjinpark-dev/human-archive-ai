"use client";

import { useEffect, useState } from "react";

interface ApiKeyInfo {
  id: string;
  key_prefix: string;
  owner: string;
  active: boolean;
  created_at: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [owner, setOwner] = useState("");
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    const res = await fetch("/api/api-keys");
    if (res.ok) setKeys(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!owner.trim()) return;
    setLoading(true);

    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner }),
    });

    if (res.ok) {
      const data = await res.json();
      setNewKey(data.api_key);
      setOwner("");
      await loadKeys();
    }
    setLoading(false);
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("이 API 키를 폐기하시겠습니까?")) return;
    await fetch(`/api/api-keys?id=${keyId}`, { method: "DELETE" });
    await loadKeys();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">API 키 관리</h1>

      {/* 새 키 생성 */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="키 소유자 이름"
          className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:bg-slate-800 dark:text-white"
        />
        <button
          type="submit"
          disabled={loading || !owner.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          키 생성
        </button>
      </form>

      {/* 새로 생성된 키 표시 */}
      {newKey && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-medium text-yellow-800 mb-2">
            새 API 키 (이 화면을 벗어나면 다시 볼 수 없습니다):
          </p>
          <code className="block p-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded text-sm break-all dark:text-white">
            {newKey}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(newKey);
              setNewKey(null);
            }}
            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            복사 후 닫기
          </button>
        </div>
      )}

      {/* 키 목록 */}
      {keys.length === 0 ? (
        <p className="text-center text-slate-400 dark:text-slate-500 py-8">
          아직 API 키가 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between border dark:border-slate-700 rounded-lg p-4 dark:bg-slate-900"
            >
              <div>
                <p className="font-medium text-sm">{k.owner}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {k.key_prefix}... ·{" "}
                  {new Date(k.created_at).toLocaleDateString("ko")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs ${k.active ? "text-green-600 dark:text-green-400" : "text-slate-400 dark:text-slate-500"}`}
                >
                  {k.active ? "활성" : "폐기됨"}
                </span>
                {k.active && (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    className="text-xs text-red-500 hover:underline whitespace-nowrap"
                  >
                    폐기
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 사용 예시 */}
      <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <h3 className="font-medium text-sm mb-2 dark:text-white">외부 API 사용법</h3>
        <pre className="text-xs text-slate-600 dark:text-slate-300 overflow-x-auto">{`curl -X POST /api/external/chat \\
  -H "x-api-key: ha_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"persona_id": "...", "message": "질문"}'`}</pre>
      </div>
    </div>
  );
}
