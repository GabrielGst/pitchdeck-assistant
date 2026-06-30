import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PipelineConfigEditor } from "@/components/PipelineConfigEditor";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

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
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/settings/pipeline">Settings</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Pipeline</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="max-w-2xl">
          {config && <PipelineConfigEditor initialConfig={config} token={token!} />}
        </div>
      </div>
    </SidebarInset>
  );
}
