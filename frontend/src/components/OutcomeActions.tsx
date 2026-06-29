"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

interface Props {
  dealId: string;
  currentStage: string;
}

const TERMINAL = new Set(["invested", "passed"]);
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export function OutcomeActions({ dealId, currentStage }: Props) {
  const [stage, setStage] = useState(currentStage);
  const [busy, setBusy] = useState<"invested" | "passed" | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"invested" | "passed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  if (TERMINAL.has(stage)) {
    const color = stage === "invested" ? "text-emerald-600" : "text-red-500";
    return (
      <span className={`text-sm font-medium ${color}`}>
        {stage === "invested" ? "Invested" : "Passed"}
      </span>
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

  if (pending) {
    return (
      <div className="flex flex-col gap-2 max-w-xs">
        <p className="text-sm font-medium">
          Mark as{" "}
          <span className={pending === "invested" ? "text-emerald-600" : "text-red-500"}>
            {pending === "invested" ? "Invested" : "Passed"}
          </span>
        </p>
        <textarea
          className="border border-gray-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          rows={2}
          placeholder={pending === "passed" ? "Reason for passing (optional)" : "Note (optional)"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => submit(pending)}
            disabled={!!busy}
            className={`px-3 py-1.5 rounded text-sm font-medium text-white disabled:opacity-50 ${
              pending === "invested" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {busy ? "Saving…" : "Confirm"}
          </button>
          <button
            onClick={() => { setPending(null); setNote(""); }}
            className="px-3 py-1.5 rounded text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setPending("invested")}
        className="px-3 py-1.5 rounded border border-emerald-300 text-sm text-emerald-700 hover:bg-emerald-50 font-medium transition-colors"
      >
        Invest
      </button>
      <button
        onClick={() => setPending("passed")}
        className="px-3 py-1.5 rounded border border-red-200 text-sm text-red-500 hover:bg-red-50 font-medium transition-colors"
      >
        Pass
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
