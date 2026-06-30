import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { KanbanBoard } from "@/components/KanbanBoard";
import { UploadButton } from "@/components/UploadButton";
import { apiFetch } from "@/lib/api";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";

interface Column {
  stage: string;
  deals: {
    id: string;
    company_name: string;
    stage: string;
    custom_stage: string | null;
    deck_id: string;
    deck_status: string;
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

  const totalDeals = columns.reduce((n, c) => n + c.deals.length, 0);
  if (totalDeals === 0) redirect("/onboarding");

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Pipeline</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {totalDeals} {totalDeals === 1 ? "deal" : "deals"}
          </span>
          <UploadButton />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-6 overflow-x-auto">
        <KanbanBoard
          columns={columns}
          stageOrder={config.stage_order}
          stageLabels={config.stage_labels}
        />
      </div>
    </SidebarInset>
  );
}
