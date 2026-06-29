"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AnalysisStream } from "@/components/AnalysisStream";

type WizardStep = "upload" | "analyse" | "complete";

const ACCEPTED = ".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";

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
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  done
                    ? "bg-blue-600 text-white"
                    : active
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs font-medium ${
                  active ? "text-blue-600" : done ? "text-gray-600" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-16 sm:w-24 mx-2 mb-5 transition-colors ${
                  i < idx ? "bg-blue-600" : "bg-gray-200"
                }`}
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
  const [token, setToken] = useState<string>("");
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

      // Fetch a fresh token right before opening the SSE stream
      const streamToken = await getToken();
      if (!streamToken) throw new Error("Not authenticated");

      // Extract company name from filename as fallback
      const name = file.name.replace(/\.(pdf|pptx)$/i, "");
      setCompanyName(name);
      setDealId(deck.deal_id);
      setToken(streamToken);
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <ProgressBar current={step} />

        {/* ── Step 1: Upload ───────────────────────────────────────────── */}
        {step === "upload" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Upload your first pitch deck
            </h1>
            <p className="text-gray-500 mb-8">
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
              className={`w-full rounded-xl border-2 border-dashed px-8 py-12 transition-colors cursor-pointer ${
                dragging
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
              } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  <p className="text-sm text-blue-600 font-medium">Uploading…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-4xl">📄</div>
                  <p className="text-sm font-medium text-gray-700">
                    Drag & drop or <span className="text-blue-600">browse</span>
                  </p>
                  <p className="text-xs text-gray-400">PDF or PPTX · up to 50 MB</p>
                </div>
              )}
            </button>

            {error && (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        {/* ── Step 2: Analyse ──────────────────────────────────────────── */}
        {step === "analyse" && dealId && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Analysing {companyName}</h1>
              <p className="text-gray-500 text-sm mt-1">
                The AI is scoring the deck, generating due diligence questions and
                writing an investment memo. This takes about 60–90 seconds.
              </p>
            </div>
            <AnalysisStream
              dealId={dealId}
              token={token}
              onComplete={() => setStep("complete")}
            />
          </div>
        )}

        {/* ── Step 3: Complete ─────────────────────────────────────────── */}
        {step === "complete" && dealId && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {companyName} is in your pipeline
            </h1>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              The scorecard, due diligence questions and investment memo are saved.
              Upload more decks or explore the full analysis now.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push(`/deals/${dealId}`)}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View full analysis
              </button>
              <button
                onClick={() => router.push("/pipeline")}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Explore Pipeline →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
