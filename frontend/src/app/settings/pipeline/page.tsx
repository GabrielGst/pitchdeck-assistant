import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PipelineConfigEditor } from "@/components/PipelineConfigEditor";

interface PipelineConfig {
  stage_order: string[];
  stage_labels: Record<string, string>;
  custom_stages: { key: string; label: string }[];
}

export default async function PipelineSettingsPage() {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) redirect("/sign-in");

  let config: PipelineConfig | null = null;
  try {
    config = await apiFetch<PipelineConfig>("/pipeline-config", token);
  } catch {
    redirect("/pipeline");
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Configuration</h1>
          <p className="text-sm text-gray-400 mt-1">
            Rename stages and add custom stages between Partner Review and terminal states.
            Changes apply immediately to the Kanban board.
          </p>
        </div>
        {config && <PipelineConfigEditor initialConfig={config} token={token!} />}
      </div>
    </main>
  );
}
