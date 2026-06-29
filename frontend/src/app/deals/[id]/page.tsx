import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AnalysisStream } from "@/components/AnalysisStream";
import { OutcomeActions } from "@/components/OutcomeActions";
import { StageSelector } from "@/components/StageSelector";
import { apiFetch } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

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
    <main className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Link
              href="/pipeline"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mt-0.5 shrink-0")}
            >
              <ChevronLeft className="h-4 w-4" />
              Pipeline
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">{deal?.company_name}</h1>
              <div className="mt-1.5">
                {deal && <StageSelector dealId={deal.id} currentStage={deal.stage} />}
              </div>
            </div>
          </div>
          {deal && (
            <div className="shrink-0 pt-1">
              <OutcomeActions dealId={deal.id} currentStage={deal.stage} />
            </div>
          )}
        </div>

        <Separator />

        <AnalysisStream dealId={id} />
      </div>
    </main>
  );
}
