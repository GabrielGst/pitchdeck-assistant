"use client";

import { useRouter } from "next/navigation";

const STAGE_LABELS: Record<string, string> = {
  inbox: "Inbox",
  screening: "Screening",
  due_diligence: "Due Diligence",
  partner_review: "Partner Review",
  invested: "Invested",
  passed: "Passed",
};

const STAGE_ORDER = ["inbox", "screening", "due_diligence", "partner_review", "invested", "passed"];

interface Deal {
  id: string;
  company_name: string;
  stage: string;
  deck_id: string;
  created_at: string;
}

interface Column {
  stage: string;
  deals: Deal[];
}

export function KanbanBoard({ columns }: { columns: Column[] }) {
  const router = useRouter();

  const sorted = [...columns].sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {sorted.map((col) => (
        <div key={col.stage} className="w-64 shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {STAGE_LABELS[col.stage] ?? col.stage}
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
