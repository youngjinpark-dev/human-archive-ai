"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [personaName, setPersonaName] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 페르소나 이름 + 채팅 이력 로드
    fetch(`/api/personas/${id}`)
      .then((r) => r.json())
      .then((p) => setPersonaName(p.name))
      .catch(() => {});

    // 최근 채팅 세션 & 메시지 로드
    async function loadHistory() {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // 최근 세션 조회
      const { data: sessions } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("persona_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!sessions || sessions.length === 0) return;

      const latestSessionId = sessions[0].id;
      setSessionId(latestSessionId);

      // 메시지 로드
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", latestSessionId)
        .order("created_at", { ascending: true });

      if (msgs && msgs.length > 0) {
        setMessages(
          msgs.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        );
      }
    }

    loadHistory();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (userMessage: string, isUserVisible: boolean = true) => {
      setLoading(true);
      setTruncated(false);

      if (isUserVisible) {
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
      }

      // 빈 어시스턴트 메시지 추가 (스트리밍용)
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch(`/api/personas/${id}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage, session_id: sessionId }),
        });

        if (!res.ok) {
          const err = await res.json();
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1].content =
              err.error || "오류가 발생했습니다.";
            return updated;
          });
          setLoading(false);
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);

                if (parsed.session_id && !sessionId) {
                  setSessionId(parsed.session_id);
                }

                if (parsed.type === "text" && parsed.text) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: last.content + parsed.text,
                      };
                    }
                    return updated;
                  });
                }

                if (parsed.type === "truncated") {
                  setTruncated(true);
                }

                if (parsed.type === "error") {
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1].content =
                      "오류: " + parsed.text;
                    return updated;
                  });
                }
              } catch {
                // skip parse errors
              }
            }
          }
        }
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant" && !last.content) {
            updated[updated.length - 1] = {
              ...last,
              content: "네트워크 오류가 발생했습니다.",
            };
          }
          return updated;
        });
      }

      setLoading(false);
    },
    [id, sessionId]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    await sendMessage(msg);
  }

  async function handleContinue() {
    // 이전 응답의 마지막 부분을 현재 어시스턴트 메시지에 이어붙이기
    setTruncated(false);
    setLoading(true);

    try {
      const res = await fetch(`/api/personas/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "이어서 계속 답변해 주세요.",
          session_id: sessionId,
        }),
      });

      if (!res.ok) {
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "text" && parsed.text) {
                // 마지막 어시스턴트 메시지에 이어붙이기
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + parsed.text,
                    };
                  }
                  return updated;
                });
              }

              if (parsed.type === "truncated") {
                setTruncated(true);
              }
            } catch {
              // skip
            }
          }
        }
      }
    } catch {
      // ignore
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="text-lg font-bold mb-4">
        {personaName && `${personaName}과(와) 대화`}
      </h1>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <p>페르소나에게 질문해 보세요.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.role === "assistant" && !m.content && loading ? (
                <p className="text-sm text-gray-400 animate-pulse">
                  생각하는 중...
                </p>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {m.content}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* 계속 버튼 */}
        {truncated && !loading && (
          <div className="flex justify-start">
            <button
              onClick={handleContinue}
              className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition border border-blue-200"
            >
              계속 이어서 보기
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          disabled={loading}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          전송
        </button>
      </form>
    </div>
  );
}
