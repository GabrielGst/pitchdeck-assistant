"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface DDQuestion {
  id: string;
  question: string;
  risk_level: "high" | "medium" | "low";
  position: number;
  answer: string | null;
}

const RISK_CLASSES = {
  high: "border-red-200 bg-red-50",
  medium: "border-amber-200 bg-amber-50",
  low: "border-emerald-200 bg-emerald-50",
};

const RISK_BADGE = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

function DDQuestionRow({
  item,
  dealId,
  getToken,
}: {
  item: DDQuestion;
  dealId: string;
  getToken: () => Promise<string | null>;
}) {
  const [answer, setAnswer] = useState(item.answer ?? "");
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function persist(value: string) {
    setSaving(true);
    try {
      const token = await getToken();
      await fetch(`/api/analysis/${dealId}/dd-questions/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answer: value }),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleChange(value: string) {
    setAnswer(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(value), 1500);
  }

  function handleBlur() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    persist(answer);
  }

  return (
    <li className={cn("rounded-lg border p-4 space-y-3", RISK_CLASSES[item.risk_level])}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase",
            RISK_BADGE[item.risk_level],
          )}
        >
          {item.risk_level}
        </span>
        <p className="text-sm leading-relaxed">{item.question}</p>
      </div>
      <div className="relative">
        <Textarea
          value={answer}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="Write your findings here…"
          rows={3}
          className="resize-none text-sm bg-white/70 border-white/50 focus:bg-white transition-colors"
        />
        {saving && (
          <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">saving…</span>
        )}
        {!saving && answer && (
          <span className="absolute bottom-2 right-2 text-xs text-emerald-600">saved</span>
        )}
      </div>
    </li>
  );
}

export function DDAnswersList({ dealId }: { dealId: string }) {
  const [questions, setQuestions] = useState<DDQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  const loadQuestions = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`/api/analysis/${dealId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    if (data.dd_questions?.length) {
      setQuestions(data.dd_questions);
    }
    setLoading(false);
  }, [dealId, getToken]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Due Diligence Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="space-y-2 rounded-lg border p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!questions.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Due Diligence Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No DD questions yet. Run the screening analysis first.
          </p>
        </CardContent>
      </Card>
    );
  }

  const answered = questions.filter((q) => q.answer?.trim()).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Due Diligence Questions</CardTitle>
          <Badge variant="outline" className="text-xs">
            {answered}/{questions.length} answered
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {questions.map((q) => (
            <DDQuestionRow
              key={q.id}
              item={q}
              dealId={dealId}
              getToken={getToken}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
