"use client";

import Disclaimer from "@/components/disclaimer";
import { TRIAL_LIMITS } from "@/lib/store-constants";
import Link from "next/link";
import { useCallback, useRef, useState, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function TrialChat({
  listingId,
  personaName,
}: {
  listingId: string;
  personaName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messagesRemaining, setMessagesRemaining] = useState<number>(TRIAL_LIMITS.MESSAGES_PER_PERSONA);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (messagesRemaining <= 0) return;

      setLoading(true);
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch(`/api/store/${listingId}/trial`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage }),
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
              } catch {
                // skip parse errors
              }
            }
          }
        }

        setMessagesRemaining((prev) => prev - 1);
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
    [listingId, messagesRemaining]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || messagesRemaining <= 0) return;
    const msg = input.trim();
    setInput("");
    sendMessage(msg);
  }

  const limitReached = messagesRemaining <= 0;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <Disclaimer />
      </div>
      <h3 className="font-semibold text-sm mb-2 dark:text-white">
        {personaName} 시식 대화
      </h3>

      <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-[200px]">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">
            <p>페르소나에게 질문해 보세요.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              }`}
            >
              {m.role === "assistant" && !m.content && loading ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 animate-pulse">
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
        <div ref={bottomRef} />
      </div>

      {!limitReached && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 text-center">
          {messagesRemaining}회 남음
        </p>
      )}

      {limitReached ? (
        <div className="text-center border dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
            로그인하여 구매하면 무제한 대화가 가능합니다
          </p>
          <Link
            href={`/store/${listingId}/purchase`}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            구매하기
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            disabled={loading}
            className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none dark:bg-slate-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            전송
          </button>
        </form>
      )}
    </div>
  );
}
