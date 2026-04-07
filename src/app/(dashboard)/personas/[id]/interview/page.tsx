"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface InterviewState {
  sessionId: string | null;
  question: string | null;
  completed: boolean;
  answers: { question: string; answer: string }[];
}

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<InterviewState>({
    sessionId: null,
    question: null,
    completed: false,
    answers: [],
  });
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    startInterview();
  }, [id]);

  async function startInterview() {
    setStarting(true);
    const res = await fetch(`/api/interview/${id}/start`, { method: "POST" });
    const data = await res.json();
    setState({
      sessionId: data.session_id,
      question: data.question,
      completed: data.completed,
      answers: [],
    });
    setStarting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !state.sessionId) return;

    setLoading(true);
    const currentQuestion = state.question!;
    const currentAnswer = answer;

    const res = await fetch(`/api/interview/${id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: state.sessionId,
        answer: currentAnswer,
      }),
    });
    const data = await res.json();

    setState((prev) => ({
      ...prev,
      question: data.next_question,
      completed: data.status === "completed",
      answers: [
        ...prev.answers,
        { question: currentQuestion, answer: currentAnswer },
      ],
    }));
    setAnswer("");
    setLoading(false);
  }

  if (starting) return <p className="text-gray-500">인터뷰 준비 중...</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">전문가 인터뷰</h1>

      {/* 이전 답변 */}
      <div className="space-y-4 mb-6">
        {state.answers.map((a, i) => (
          <div key={i} className="space-y-2">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-blue-800">{a.question}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg ml-4">
              <p className="text-sm text-gray-700">{a.answer}</p>
            </div>
          </div>
        ))}
      </div>

      {state.completed ? (
        <div className="text-center py-8 border rounded-lg bg-green-50">
          <p className="text-lg font-medium text-green-700">
            인터뷰가 완료되었습니다!
          </p>
          <p className="text-sm text-green-600 mt-1">
            페르소나에 판단 원칙과 시나리오가 반영되었습니다.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="font-medium text-blue-800">{state.question}</p>
          </div>

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            placeholder="답변을 입력하세요..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />

          <button
            type="submit"
            disabled={loading || !answer.trim()}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? "처리 중..." : "답변 제출"}
          </button>
        </form>
      )}
    </div>
  );
}
