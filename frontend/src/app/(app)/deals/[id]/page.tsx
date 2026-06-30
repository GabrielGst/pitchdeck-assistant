import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AnalysisStream } from "@/components/AnalysisStream";
import { OutcomeActions } from "@/components/OutcomeActions";
import { StageSelector } from "@/components/StageSelector";
import { apiFetch } from "@/lib/api";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface DealDetail {
  id: string;
  company_name: string;
  stage: string;
  deck_status: string;
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) redirect("/sign-in");

  let deal: DealDetail | null = null;
  try {
    deal = await apiFetch<DealDetail>(`/deals/${id}`, token);
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
              <BreadcrumbLink href="/pipeline">Pipeline</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{deal?.company_name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {deal && (
          <div className="ml-auto flex items-center gap-3">
            <StageSelector dealId={deal.id} currentStage={deal.stage} />
            <OutcomeActions dealId={deal.id} currentStage={deal.stage} />
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="max-w-4xl">
          <AnalysisStream dealId={id} />
        </div>
      </div>
    </SidebarInset>
  );
}
