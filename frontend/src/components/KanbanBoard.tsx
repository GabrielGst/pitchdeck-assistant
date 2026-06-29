"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trash2, GripVertical } from "lucide-react";

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
    return <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">Ready</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="outline" className="text-xs text-destructive border-destructive/20 bg-destructive/5">Failed</Badge>;
  }
  return (
    <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse mr-1" />
      Processing
    </Badge>
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
          <div className="mb-2 flex items-center justify-between px-0.5">
            <h3 className="text-sm font-semibold text-foreground">
              {labels[col.stage] ?? col.stage}
            </h3>
            <Badge variant="secondary" className="text-xs tabular-nums">
              {col.deals.length}
            </Badge>
          </div>

          <div
            className={cn(
              "space-y-2 min-h-16 rounded-lg p-2 transition-colors",
              dragOverStage === col.stage
                ? "bg-primary/5 ring-2 ring-primary/30 ring-inset"
                : "bg-muted/50"
            )}
          >
            {col.deals.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                {dragOverStage === col.stage ? "Drop here" : "Empty"}
              </p>
            )}

            {col.deals.map((deal) => (
              <Card
                key={deal.id}
                draggable
                onDragStart={() => {
                  dragInfo.current = { dealId: deal.id, fromStage: col.stage };
                }}
                onDragEnd={() => {
                  dragInfo.current = null;
                  setDragOverStage(null);
                }}
                className="group cursor-grab active:cursor-grabbing select-none shadow-sm hover:shadow-md transition-shadow"
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-1.5">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
                    <button
                      onClick={() => router.push(`/deals/${deal.id}`)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {deal.company_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(deal.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </p>
                    </button>
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      {confirmDelete === deal.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 px-2 text-xs"
                            onClick={() => deleteDeal(deal.id)}
                          >
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => setConfirmDelete(null)}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDelete(deal.id)}
                          title="Delete deal"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 ml-5">
                    <DeckBadge status={deal.deck_status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
