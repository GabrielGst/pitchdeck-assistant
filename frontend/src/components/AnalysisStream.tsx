"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

const RISK_CLASSES = {
  high: "border-red-200 bg-red-50 text-red-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const RISK_BADGE_CLASSES = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
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
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={cn(
              "h-2 w-5 rounded-sm transition-colors",
              n <= score ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{score}/5</span>
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
      // best-effort: drop on failure
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

  const loading = stage !== "complete" && stage !== "error";

  return (
    <div className="space-y-6">
      {loading && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
            <p className="text-sm text-primary font-medium">{progressLabel[stage]}</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Scorecard skeleton while loading */}
      {loading && scorecard.length === 0 && stage !== "idle" && (
        <section>
          <h2 className="text-base font-semibold mb-3">Scorecard</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <Card key={n}>
                <CardContent className="pt-4 pb-4 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-2 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {scorecard.length > 0 && (
        <section ref={scorecardRef}>
          <h2 className="text-base font-semibold mb-3">Scorecard</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scorecard.map((dim) => (
              <Card key={dim.key}>
                <CardHeader className="pb-1 pt-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {DIM_LABELS[dim.key] ?? dim.key}
                    {dim.is_custom && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">custom</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <ScoreBar score={dim.score} />
                  {dim.rationale && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {dim.rationale}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {ddQuestions.length > 0 && (
        <section ref={ddRef}>
          <h2 className="text-base font-semibold mb-3">Due Diligence Questions</h2>
          <ul className="space-y-2">
            {ddQuestions.map((item, i) => (
              <li
                key={i}
                onClick={() =>
                  enqueue({ event_type: "dd_question_clicked", section: "dd_questions", value: item.position })
                }
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm cursor-default",
                  RISK_CLASSES[item.risk_level]
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase",
                    RISK_BADGE_CLASSES[item.risk_level]
                  )}
                >
                  {item.risk_level}
                </span>
                <span className="leading-relaxed">{item.question}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {memo && (
        <section ref={memoSectionRef}>
          <h2 className="text-base font-semibold mb-3">Investment Memo</h2>
          <Card>
            <CardContent className="pt-5 pb-5">
              <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                {memo}
              </pre>
              <div ref={memoRef} />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
