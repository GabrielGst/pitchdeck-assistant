"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STAGES = [
  { value: "inbox", label: "Inbox" },
  { value: "screening", label: "Screening" },
  { value: "due_diligence", label: "Due Diligence" },
  { value: "partner_review", label: "Partner Review" },
  { value: "invested", label: "Invested" },
  { value: "passed", label: "Passed" },
];

const STAGE_CLASSES: Record<string, string> = {
  inbox: "bg-muted text-muted-foreground",
  screening: "bg-blue-50 text-blue-700",
  due_diligence: "bg-purple-50 text-purple-700",
  partner_review: "bg-amber-50 text-amber-700",
  invested: "bg-emerald-50 text-emerald-700",
  passed: "bg-red-50 text-red-600",
};

const API = "/api";

interface Props {
  dealId: string;
  currentStage: string;
  onStageChange?: (newStage: string) => void;
}

export function StageSelector({ dealId, currentStage, onStageChange }: Props) {
  const [stage, setStage] = useState(currentStage);
  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();

  async function handleChange(newStage: string | null) {
    if (!newStage || newStage === stage || loading) return;
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

  const colorClass = STAGE_CLASSES[stage] ?? STAGE_CLASSES.inbox;

  return (
    <Select value={stage} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger
        className={cn(
          "h-7 w-auto min-w-28 rounded-full border-0 px-3 text-xs font-medium shadow-none focus:ring-1",
          colorClass,
          loading && "opacity-60"
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGES.map(({ value, label }) => (
          <SelectItem key={value} value={value} className="text-sm">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
