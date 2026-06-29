import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { KanbanBoard } from "@/components/KanbanBoard";
import { UploadButton } from "@/components/UploadButton";
import { apiFetch } from "@/lib/api";

interface Column {
  stage: string;
  deals: {
    id: string;
    company_name: string;
    stage: string;
    custom_stage: string | null;
    deck_id: string;
    created_at: string;
  }[];
}

interface PipelineConfig {
  stage_order: string[];
  stage_labels: Record<string, string>;
  custom_stages: { key: string; label: string }[];
}

export default async function PipelinePage() {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) redirect("/sign-in");

  let columns: Column[] = [];
  let config: PipelineConfig = {
    stage_order: ["inbox", "screening", "due_diligence", "partner_review", "invested", "passed"],
    stage_labels: {
      inbox: "Inbox", screening: "Screening", due_diligence: "Due Diligence",
      partner_review: "Partner Review", invested: "Invested", passed: "Passed",
    },
    custom_stages: [],
  };

  await Promise.all([
    apiFetch<Column[]>("/deals/kanban", token).then((d) => { columns = d; }).catch(() => {}),
    apiFetch<PipelineConfig>("/pipeline-config", token).then((d) => { config = d; }).catch(() => {}),
  ]);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Deal Pipeline</h1>
            <p className="text-gray-500 text-sm">
              {columns.reduce((n, c) => n + c.deals.length, 0)} deals
            </p>
          </div>
          <UploadButton />
        </div>
        <KanbanBoard
          columns={columns}
          stageOrder={config.stage_order}
          stageLabels={config.stage_labels}
        />
      </div>
    </main>
  );
}
