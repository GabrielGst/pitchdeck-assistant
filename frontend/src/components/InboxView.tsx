"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TriageData {
  company: string;
  sector: string;
  funding_stage: string;
  key_metrics: string[];
  thesis_fit: "strong" | "moderate" | "weak" | "unknown";
  thesis_fit_reason: string;
  summary: string;
}

interface InboxViewProps {
  dealId: string;
  companyName: string;
  triage: TriageData | null;
  deckStatus: string;
}

const fitColors: Record<string, string> = {
  strong: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  moderate: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  weak: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  unknown: "bg-muted text-muted-foreground",
};

export function InboxView({ dealId, companyName, triage, deckStatus }: InboxViewProps) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<"screen" | "pass" | null>(null);

  async function transition(stage: "screening" | "passed") {
    setLoading(stage === "screening" ? "screen" : "pass");
    const token = await getToken();
    await fetch(`/api/deals/${dealId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stage }),
    });
    router.refresh();
  }

  const isProcessing = deckStatus === "pending" || deckStatus === "processing";

  return (
    <div className="max-w-2xl space-y-4">
      {isProcessing || !triage ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Clock className="h-8 w-8 text-muted-foreground animate-pulse" />
            <p className="text-sm font-medium">Extracting deck content…</p>
            <p className="text-xs text-muted-foreground">
              Triage analysis will appear here once processing completes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Triage snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Sector</p>
                  <p className="font-medium">{triage.sector || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Stage</p>
                  <p className="font-medium">{triage.funding_stage || "—"}</p>
                </div>
              </div>

              {triage.key_metrics.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Key metrics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {triage.key_metrics.map((m) => (
                      <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Thesis fit</p>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${fitColors[triage.thesis_fit]}`}>
                    {triage.thesis_fit}
                  </span>
                  <span className="text-xs text-muted-foreground">{triage.thesis_fit_reason}</span>
                </div>
              </div>

              {triage.summary && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Summary</p>
                  <p className="text-sm leading-relaxed">{triage.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              onClick={() => transition("screening")}
              disabled={loading !== null}
              className="gap-2"
            >
              <ArrowRight className="h-4 w-4" />
              {loading === "screen" ? "Moving…" : "Proceed to Screening"}
            </Button>
            <Button
              variant="outline"
              onClick={() => transition("passed")}
              disabled={loading !== null}
              className="gap-2 text-muted-foreground"
            >
              <X className="h-4 w-4" />
              {loading === "pass" ? "Passing…" : "Pass"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
