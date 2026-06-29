"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AnalysisStream } from "@/components/AnalysisStream";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, FileText } from "lucide-react";

type WizardStep = "upload" | "analyse" | "complete";

const ACCEPTED = ".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const API = "/api";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "analyse", label: "Analyse" },
  { id: "complete", label: "Review" },
];

function ProgressBar({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center justify-center gap-0 mb-12">
      {STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-16 sm:w-24 mx-2 mb-5 transition-colors",
                  i < idx ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OnboardingWizard() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [dealId, setDealId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { getToken } = useAuth();
  const router = useRouter();

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const t = await getToken();
      if (!t) throw new Error("Not authenticated");

      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/decks`, {
        method: "POST",
        body: form,
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(body.detail ?? "Upload failed");
      }
      const deck = await res.json();
      const name = file.name.replace(/\.(pdf|pptx)$/i, "");
      setCompanyName(name);
      setDealId(deck.deal_id);
      setStep("analyse");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <ProgressBar current={step} />

        {step === "upload" && (
          <Card className="p-10 text-center">
            <CardContent className="p-0">
              <h1 className="text-2xl font-bold mb-2">Upload your first pitch deck</h1>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Drop a PDF or PPTX and the AI will score it, generate due diligence
                questions and write an investment memo — live.
              </p>

              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />

              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "w-full rounded-xl border-2 border-dashed px-8 py-12 transition-colors cursor-pointer",
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50",
                  uploading && "opacity-50 cursor-not-allowed"
                )}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-primary font-medium">Uploading…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      Drag & drop or{" "}
                      <span className="text-primary">browse</span>
                    </p>
                    <p className="text-xs text-muted-foreground">PDF or PPTX · up to 50 MB</p>
                  </div>
                )}
              </button>

              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        )}

        {step === "analyse" && dealId && (
          <Card className="p-8">
            <CardContent className="p-0">
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Analysing {companyName}</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Scoring the deck, generating due diligence questions and writing an
                  investment memo. This takes about 60–90 seconds.
                </p>
              </div>
              <AnalysisStream dealId={dealId} onComplete={() => setStep("complete")} />
            </CardContent>
          </Card>
        )}

        {step === "complete" && dealId && (
          <Card className="p-10 text-center">
            <CardContent className="p-0">
              <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Check className="h-7 w-7 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold mb-2">
                {companyName} is in your pipeline
              </h1>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                The scorecard, due diligence questions and investment memo are saved.
                Upload more decks or explore the full analysis now.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" onClick={() => router.push(`/deals/${dealId}`)}>
                  View full analysis
                </Button>
                <Button onClick={() => router.push("/pipeline")}>
                  Explore Pipeline
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
