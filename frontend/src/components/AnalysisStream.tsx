"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";

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

// ── Engagement tracking ────────────────────────────────────────────────────

interface EngagementEvent {
  event_type: string;
  section: string | null;
  value: number | null;
  timestamp: string;
}

function useEngagementTracker(dealId: string, analysisComplete: boolean) {
  const queueRef = useRef<EngagementEvent[]>([]);
  const { getToken } = useAuth();

  function enqueue(ev: Omit<EngagementEvent, "timestamp">) {
    if (!analysisComplete) return;
    queueRef.current.push({ ...ev, timestamp: new Date().toISOString() });
  }

  async function flush() {
    if (queueRef.current.length === 0) return;
    const events = queueRef.current.splice(0);
    try {
      const token = await getToken();
      if (!token) return;
      await fetch("/api/events/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deal_id: dealId, events }),
        keepalive: true,
      });
    } catch {
      // best-effort: drop on failure, not user-facing
    }
  }

  useEffect(() => {
    const id = setInterval(flush, 30_000);
    return () => clearInterval(id);
  }, [analysisComplete]);

  useEffect(() => {
    const handler = () => { flush(); };
    window.addEventListener("visibilitychange", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("visibilitychange", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, [analysisComplete]);

  return { enqueue, flush };
}

function useSectionDwell(
  ref: React.RefObject<HTMLElement | null>,
  section: string,
  active: boolean,
  enqueue: (ev: Omit<EngagementEvent, "timestamp">) => void,
) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    let enteredAt: number | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          enteredAt = Date.now();
        } else if (enteredAt !== null) {
          const dwell = (Date.now() - enteredAt) / 1000;
          enqueue({ event_type: "section_dwell", section, value: dwell });
          enteredAt = null;
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => {
      if (enteredAt !== null) {
        const dwell = (Date.now() - enteredAt) / 1000;
        enqueue({ event_type: "section_dwell", section, value: dwell });
      }
      observer.disconnect();
    };
  }, [active, section]);
}

// ── Main component ─────────────────────────────────────────────────────────

export function AnalysisStream({ dealId, onComplete }: { dealId: string; onComplete?: () => void }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [scorecard, setScorecard] = useState<ScoreDim[]>([]);
  const [ddQuestions, setDdQuestions] = useState<DDItem[]>([]);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<Stage>("idle");
  const memoRef = useRef<HTMLDivElement>(null);
  const scorecardRef = useRef<HTMLElement>(null);
  const ddRef = useRef<HTMLElement>(null);
  const memoSectionRef = useRef<HTMLElement>(null);

  const complete = stage === "complete";
  const { getToken } = useAuth();
  const { enqueue, flush } = useEngagementTracker(dealId, complete);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    async function init() {
      const token = await getToken();
      if (cancelled) return;

      // Pre-check: skip stream if analysis already complete
      try {
        const res = await fetch(`/api/analysis/${dealId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.status === "complete") {
            setScorecard(data.scorecard ?? []);
            setDdQuestions(data.dd_questions ?? []);
            setMemo(data.memo_text ?? "");
            setStage("complete");
            onComplete?.();
            return;
          }
        }
      } catch {
        // fall through to stream
      }

      if (!cancelled) es = startStream();
    }

    function startStream(): EventSource {
      // Token not needed in URL — SSE Route Handler handles auth via Clerk cookie
      const source = new EventSource(`/api/analysis/${dealId}/stream`);

      source.addEventListener("progress", (e) => {
        const data = JSON.parse(e.data);
        setStage(data.stage as Stage);
      });

      source.addEventListener("scorecard", (e) => {
        setScorecard(JSON.parse(e.data));
      });

      source.addEventListener("dd_questions", (e) => {
        setDdQuestions(JSON.parse(e.data));
      });

      source.addEventListener("memo_chunk", (e) => {
        const { text } = JSON.parse(e.data);
        setMemo((prev) => prev + text);
        setTimeout(() => memoRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
      });

      source.addEventListener("done", () => {
        setStage("complete");
        source.close();
        onComplete?.();
      });

      source.addEventListener("error", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data ?? "{}");
          setError(data.message ?? "Analysis failed");
        } catch {
          setError("Connection lost");
        }
        setStage("error");
        source.close();
      });

      source.onerror = () => {
        if (stageRef.current !== "complete") {
          setError("Stream connection lost — please retry");
          setStage("error");
        }
        source.close();
      };

      return source;
    }

    init();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [dealId]);

  useSectionDwell(scorecardRef, "scorecard", complete, enqueue);
  useSectionDwell(ddRef, "dd_questions", complete, enqueue);
  useSectionDwell(memoSectionRef, "memo", complete, enqueue);

  useEffect(() => {
    if (!complete) return;
    const handler = () => enqueue({ event_type: "memo_copied", section: "memo", value: null });
    document.addEventListener("copy", handler);
    return () => document.removeEventListener("copy", handler);
  }, [complete]);

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
      {stage !== "complete" && stage !== "error" && (
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-blue-700">{progressLabel[stage]}</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {scorecard.length > 0 && (
        <section ref={scorecardRef}>
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

      {ddQuestions.length > 0 && (
        <section ref={ddRef}>
          <h2 className="text-lg font-semibold mb-3">Due Diligence Questions</h2>
          <ul className="space-y-2">
            {ddQuestions.map((item, i) => (
              <li
                key={i}
                onClick={() => enqueue({ event_type: "dd_question_clicked", section: "dd_questions", value: item.position })}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm cursor-default ${RISK_COLORS[item.risk_level]}`}
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

      {memo && (
        <section ref={memoSectionRef}>
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
