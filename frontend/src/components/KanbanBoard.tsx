"use client";

import { useRouter } from "next/navigation";

interface Deal {
  id: string;
  company_name: string;
  stage: string;
  custom_stage: string | null;
  deck_id: string;
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

const DEFAULT_STAGE_LABELS: Record<string, string> = {
  inbox: "Inbox", screening: "Screening", due_diligence: "Due Diligence",
  partner_review: "Partner Review", invested: "Invested", passed: "Passed",
};

const DEFAULT_STAGE_ORDER = [
  "inbox", "screening", "due_diligence", "partner_review", "invested", "passed",
];

export function KanbanBoard({ columns, stageOrder, stageLabels }: Props) {
  const router = useRouter();
  const order = stageOrder ?? DEFAULT_STAGE_ORDER;
  const labels = stageLabels ?? DEFAULT_STAGE_LABELS;

  const sorted = [...columns].sort(
    (a, b) => {
      const ai = order.indexOf(a.stage);
      const bi = order.indexOf(b.stage);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {sorted.map((col) => (
        <div key={col.stage} className="w-64 shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {labels[col.stage] ?? col.stage}
            </h3>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              {col.deals.length}
            </span>
          </div>
          <div className="space-y-2 min-h-[4rem] rounded-lg bg-gray-100 p-2">
            {col.deals.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Empty</p>
            )}
            {col.deals.map((deal) => (
              <button
                key={deal.id}
                onClick={() => router.push(`/deals/${deal.id}`)}
                className="w-full rounded-md bg-white border border-gray-200 p-3 text-left shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="text-sm font-medium text-gray-900 truncate">{deal.company_name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(deal.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
