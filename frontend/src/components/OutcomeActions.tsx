"use client";

import { useState } from "react";

interface Props {
  dealId: string;
  currentStage: string;
  token: string;
}

const TERMINAL = new Set(["invested", "passed"]);

export function OutcomeActions({ dealId, currentStage, token }: Props) {
  const [stage, setStage] = useState(currentStage);
  const [busy, setBusy] = useState<"invested" | "passed" | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"invested" | "passed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (TERMINAL.has(stage)) {
    const label = stage === "invested" ? "Invested" : "Passed";
    const color = stage === "invested" ? "text-green-600" : "text-red-500";
    return (
      <span className={`text-sm font-medium ${color}`}>
        Marked as {label}
      </span>
    );
  }

  async function submit(outcome: "invested" | "passed") {
    setError(null);
    setBusy(outcome);
    const body: Record<string, string> = { stage: outcome };
    if (note.trim()) body.note = note.trim();

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "/api"}/deals/${dealId}/stage`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }
    );
    setBusy(null);
    setPending(null);
    setNote("");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.detail ?? "Failed to update deal stage.");
      return;
    }
    setStage(outcome);
  }

  if (pending) {
    return (
      <div className="flex flex-col gap-2 max-w-xs">
        <p className="text-sm font-medium">
          Mark as <span className={pending === "invested" ? "text-green-600" : "text-red-500"}>
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
            disabled={busy === pending}
            className={`px-3 py-1.5 rounded text-sm font-medium text-white disabled:opacity-50 ${
              pending === "invested" ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"
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
        className="px-3 py-1.5 rounded border border-green-300 text-sm text-green-700 hover:bg-green-50 font-medium"
      >
        Mark as Invested
      </button>
      <button
        onClick={() => setPending("passed")}
        className="px-3 py-1.5 rounded border border-red-200 text-sm text-red-500 hover:bg-red-50 font-medium"
      >
        Mark as Passed
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
