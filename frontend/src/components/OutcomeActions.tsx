"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  dealId: string;
  currentStage: string;
}

const TERMINAL = new Set(["invested", "passed"]);
const API = "/api";

export function OutcomeActions({ dealId, currentStage }: Props) {
  const [stage, setStage] = useState(currentStage);
  const [busy, setBusy] = useState<"invested" | "passed" | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"invested" | "passed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  if (TERMINAL.has(stage)) {
    return (
      <Badge
        variant="outline"
        className={cn(
          stage === "invested"
            ? "text-emerald-700 border-emerald-200 bg-emerald-50"
            : "text-red-600 border-red-200 bg-red-50"
        )}
      >
        {stage === "invested" ? "Invested" : "Passed"}
      </Badge>
    );
  }

  async function submit(outcome: "invested" | "passed") {
    setError(null);
    setBusy(outcome);
    try {
      const token = await getToken();
      const body: Record<string, string> = { stage: outcome };
      if (note.trim()) body.note = note.trim();
      const res = await fetch(`${API}/deals/${dealId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail ?? "Failed to update.");
        return;
      }
      setStage(outcome);
      setPending(null);
      setNote("");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPending("invested")}
          className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
        >
          Invest
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPending("passed")}
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          Pass
        </Button>
      </div>

      <Dialog open={!!pending} onOpenChange={(open) => { if (!open) { setPending(null); setNote(""); setError(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Mark as{" "}
              <span className={pending === "invested" ? "text-emerald-700" : "text-red-600"}>
                {pending === "invested" ? "Invested" : "Passed"}
              </span>
            </DialogTitle>
            <DialogDescription>
              {pending === "passed"
                ? "Optionally record why this deal was passed."
                : "Optionally add a note for this investment decision."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={pending === "passed" ? "Reason for passing (optional)" : "Note (optional)"}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="resize-none"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPending(null); setNote(""); setError(null); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => pending && submit(pending)}
              disabled={!!busy}
              className={cn(
                pending === "invested"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              )}
            >
              {busy ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
