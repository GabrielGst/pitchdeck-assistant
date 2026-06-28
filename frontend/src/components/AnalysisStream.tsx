"use client";

import { useEffect, useRef, useState } from "react";

interface ScoreDim {
  key: string;
  score: number;
  ai_score: number;
  rationale: string;
  is_custom: boolean;
}

interface DDItem {
  question: string;
  risk_level: "high" | "medium" | "low";
  position: number;
}

type Stage = "idle" | "scorecard" | "dd_questions" | "memo" | "complete" | "error";

const RISK_COLORS = {
  high: "bg-red-50 border-red-200 text-red-800",
  medium: "bg-yellow-50 border-yellow-200 text-yellow-800",
  low: "bg-green-50 border-green-200 text-green-800",
};

const DIM_LABELS: Record<string, string> = {
  team: "Team",
  market_size: "Market Size",
  traction: "Traction",
  business_model: "Business Model",
  competition: "Competition",
  financials: "Financials",
  overall: "Overall",
};

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`h-2 w-5 rounded-sm ${n <= score ? "bg-blue-500" : "bg-gray-200"}`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500">{score}/5</span>
    </div>
  );
}

export function AnalysisStream({ dealId, token }: { dealId: string; token: string }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [scorecard, setScorecard] = useState<ScoreDim[]>([]);
  const [ddQuestions, setDdQuestions] = useState<DDItem[]>([]);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const memoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const es = new EventSource(
      `${apiUrl}/analysis/${dealId}/stream?token=${encodeURIComponent(token)}`
    );

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      setStage(data.stage as Stage);
    });

    es.addEventListener("scorecard", (e) => {
      setScorecard(JSON.parse(e.data));
    });

    es.addEventListener("dd_questions", (e) => {
      setDdQuestions(JSON.parse(e.data));
    });

    es.addEventListener("memo_chunk", (e) => {
      const { text } = JSON.parse(e.data);
      setMemo((prev) => prev + text);
      setTimeout(() => memoRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
    });

    es.addEventListener("done", () => {
      setStage("complete");
      es.close();
    });

    es.addEventListener("error", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data ?? "{}");
        setError(data.message ?? "Analysis failed");
      } catch {
        setError("Connection lost");
      }
      setStage("error");
      es.close();
    });

    es.onerror = () => {
      if (stage !== "complete") {
        setError("Stream connection lost");
        setStage("error");
      }
      es.close();
    };

    return () => es.close();
  }, [dealId, token]);

  const progressLabel: Record<Stage, string> = {
    idle: "Starting analysis…",
    scorecard: "Scoring the deck…",
    dd_questions: "Generating due diligence questions…",
    memo: "Writing investment memo…",
    complete: "Analysis complete",
    error: "Analysis failed",
  };

  return (
    <div className="space-y-8">
      {/* Progress bar */}
      {stage !== "complete" && stage !== "error" && (
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-blue-700">{progressLabel[stage]}</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Scorecard */}
      {scorecard.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Scorecard</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scorecard.map((dim) => (
              <div key={dim.key} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">
                    {DIM_LABELS[dim.key] ?? dim.key}
                    {dim.is_custom && (
                      <span className="ml-1 text-xs text-purple-600">(custom)</span>
                    )}
                  </span>
                </div>
                <ScoreBar score={dim.score} />
                {dim.rationale && (
                  <p className="text-xs text-gray-500 mt-2">{dim.rationale}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* DD Questions */}
      {ddQuestions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Due Diligence Questions</h2>
          <ul className="space-y-2">
            {ddQuestions.map((item, i) => (
              <li
                key={i}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${RISK_COLORS[item.risk_level]}`}
              >
                <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium uppercase">
                  {item.risk_level}
                </span>
                <span>{item.question}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Streaming Memo */}
      {memo && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Investment Memo</h2>
          <div className="prose prose-sm max-w-none rounded-lg border border-gray-200 bg-white p-6">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">{memo}</pre>
            <div ref={memoRef} />
          </div>
        </section>
      )}
    </div>
  );
}
