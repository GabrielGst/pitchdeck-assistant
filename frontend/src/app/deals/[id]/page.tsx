import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AnalysisStream } from "@/components/AnalysisStream";
import { apiFetch } from "@/lib/api";

interface DealDetail {
  id: string;
  company_name: string;
  stage: string;
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
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <a href="/pipeline" className="text-sm text-gray-400 hover:text-gray-600">
            ← Pipeline
          </a>
          <div>
            <h1 className="text-2xl font-bold">{deal?.company_name}</h1>
            <span className="text-xs text-gray-400 uppercase tracking-wide">
              {deal?.stage.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Analysis — streams live from SSE */}
        <AnalysisStream dealId={id} token={token} />
      </div>
    </main>
  );
}
