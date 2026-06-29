"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

const STAGES = [
  { value: "inbox", label: "Inbox" },
  { value: "screening", label: "Screening" },
  { value: "due_diligence", label: "Due Diligence" },
  { value: "partner_review", label: "Partner Review" },
  { value: "invested", label: "Invested" },
  { value: "passed", label: "Passed" },
];

const STAGE_COLORS: Record<string, string> = {
  inbox: "bg-gray-100 text-gray-700",
  screening: "bg-blue-50 text-blue-700",
  due_diligence: "bg-purple-50 text-purple-700",
  partner_review: "bg-amber-50 text-amber-700",
  invested: "bg-emerald-50 text-emerald-700",
  passed: "bg-red-50 text-red-700",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";

interface Props {
  dealId: string;
  currentStage: string;
  onStageChange?: (newStage: string) => void;
}

export function StageSelector({ dealId, currentStage, onStageChange }: Props) {
  const [stage, setStage] = useState(currentStage);
  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();

  const label = STAGES.find((s) => s.value === stage)?.label ?? stage.replace(/_/g, " ");
  const colorClass = STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-700";

  async function handleChange(newStage: string) {
    if (newStage === stage || loading) return;
    setLoading(true);
    const prev = stage;
    setStage(newStage);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/deals/${dealId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error();
      onStageChange?.(newStage);
    } catch {
      setStage(prev);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative inline-flex items-center">
      <span className={`absolute left-2 h-1.5 w-1.5 rounded-full ${loading ? "animate-pulse bg-gray-400" : colorClass.split(" ")[1].replace("text", "bg")}`} />
      <select
        value={stage}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        className={`pl-5 pr-7 py-1 rounded-full text-xs font-medium border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 transition-opacity ${colorClass} ${loading ? "opacity-60" : ""}`}
      >
        {STAGES.map(({ value, label: lbl }) => (
          <option key={value} value={value}>{lbl}</option>
        ))}
      </select>
      <span className="absolute right-2 pointer-events-none text-current opacity-50">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5">
          <path d="M6 8L1 3h10L6 8z"/>
        </svg>
      </span>
    </div>
  );
}
