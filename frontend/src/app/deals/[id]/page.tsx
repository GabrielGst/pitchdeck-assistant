import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AnalysisStream } from "@/components/AnalysisStream";
import { OutcomeActions } from "@/components/OutcomeActions";
import { StageSelector } from "@/components/StageSelector";
import { apiFetch } from "@/lib/api";

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
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/pipeline" className="shrink-0 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Pipeline
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">{deal?.company_name}</h1>
              <div className="mt-1">
                {deal && (
                  <StageSelector dealId={deal.id} currentStage={deal.stage} />
                )}
              </div>
            </div>
          </div>
          {deal && (
            <div className="shrink-0">
              <OutcomeActions dealId={deal.id} currentStage={deal.stage} />
            </div>
          )}
        </div>

        {/* Analysis */}
        <AnalysisStream dealId={id} />
      </div>
    </main>
  );
}
