"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

interface Deal {
  id: string;
  company_name: string;
  stage: string;
  custom_stage: string | null;
  deck_id: string;
  deck_status: string;
  created_at: string;
}

interface Column {
  stage: string;
  deals: Deal[];
}

interface Props {
  columns: Column[];
  stageOrder?: string[];
  stageLabels?: Record<string, string>;
}

const API = "/api";

const DEFAULT_STAGE_LABELS: Record<string, string> = {
  inbox: "Inbox", screening: "Screening", due_diligence: "Due Diligence",
  partner_review: "Partner Review", invested: "Invested", passed: "Passed",
};

const DEFAULT_STAGE_ORDER = [
  "inbox", "screening", "due_diligence", "partner_review", "invested", "passed",
];

function DeckBadge({ status }: { status: string }) {
  if (status === "processed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Ready
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
      Processing
    </span>
  );
}

export function KanbanBoard({ columns: initialColumns, stageOrder, stageLabels }: Props) {
  const [columns, setColumns] = useState(initialColumns);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const dragInfo = useRef<{ dealId: string; fromStage: string } | null>(null);
  const { getToken } = useAuth();
  const router = useRouter();

  const order = stageOrder ?? DEFAULT_STAGE_ORDER;
  const labels = stageLabels ?? DEFAULT_STAGE_LABELS;

  const sorted = [...columns].sort((a, b) => {
    const ai = order.indexOf(a.stage);
    const bi = order.indexOf(b.stage);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  async function moveCard(dealId: string, fromStage: string, toStage: string) {
    if (fromStage === toStage) return;

    setColumns((prev) => {
      const deal = prev.find((c) => c.stage === fromStage)?.deals.find((d) => d.id === dealId);
      if (!deal) return prev;
      const moved = { ...deal, stage: toStage, custom_stage: null };
      return prev.map((col) => {
        if (col.stage === fromStage) return { ...col, deals: col.deals.filter((d) => d.id !== dealId) };
        if (col.stage === toStage) return { ...col, deals: [moved, ...col.deals] };
        return col;
      });
    });

    try {
      const token = await getToken();
      const res = await fetch(`${API}/deals/${dealId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage: toStage }),
      });
      if (!res.ok) throw new Error();
    } catch {
      router.refresh();
    }
  }

  async function deleteDeal(dealId: string) {
    setConfirmDelete(null);
    setColumns((prev) =>
      prev.map((col) => ({ ...col, deals: col.deals.filter((d) => d.id !== dealId) }))
    );
    try {
      const token = await getToken();
      await fetch(`${API}/deals/${dealId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      router.refresh();
    }
  }

  return (
    <div
      className="flex gap-4 overflow-x-auto pb-4"
      onClick={() => confirmDelete && setConfirmDelete(null)}
    >
      {sorted.map((col) => (
        <div
          key={col.stage}
          className="w-64 shrink-0"
          onDragOver={(e) => { e.preventDefault(); setDragOverStage(col.stage); }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setDragOverStage(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverStage(null);
            if (dragInfo.current) {
              moveCard(dragInfo.current.dealId, dragInfo.current.fromStage, col.stage);
              dragInfo.current = null;
            }
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {labels[col.stage] ?? col.stage}
            </h3>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              {col.deals.length}
            </span>
          </div>

          <div
            className={`space-y-2 min-h-[4rem] rounded-lg p-2 transition-colors ${
              dragOverStage === col.stage ? "bg-blue-50 ring-2 ring-blue-300 ring-inset" : "bg-gray-100"
            }`}
          >
            {col.deals.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">
                {dragOverStage === col.stage ? "Drop here" : "Empty"}
              </p>
            )}

            {col.deals.map((deal) => (
              <div
                key={deal.id}
                draggable
                onDragStart={() => {
                  dragInfo.current = { dealId: deal.id, fromStage: col.stage };
                }}
                onDragEnd={() => {
                  dragInfo.current = null;
                  setDragOverStage(null);
                }}
                className="group rounded-md bg-white border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing select-none"
              >
                <div className="flex items-start gap-2">
                  {/* Main clickable area */}
                  <button
                    onClick={() => router.push(`/deals/${deal.id}`)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{deal.company_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(deal.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                  </button>

                  {/* Delete control */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {confirmDelete === deal.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => deleteDeal(deal.id)}
                          className="text-xs text-white bg-red-500 hover:bg-red-600 rounded px-1.5 py-0.5 font-medium"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(deal.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 leading-none"
                        title="Delete deal"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Deck status */}
                <div className="mt-2">
                  <DeckBadge status={deal.deck_status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
