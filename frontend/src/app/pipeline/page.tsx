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
    deck_id: string;
    created_at: string;
  }[];
}

export default async function PipelinePage() {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) redirect("/sign-in");

  let columns: Column[] = [];
  try {
    columns = await apiFetch<Column[]>("/deals/kanban", token);
  } catch {
    // Board renders empty on error; inline message shown below
  }

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
        <KanbanBoard columns={columns} />
      </div>
    </main>
  );
}
