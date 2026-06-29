import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface StageCount { stage: string; count: number; }
interface DwellTime { stage: string; avg_days: number; }
interface DimAverage { dimension_key: string; avg_ai_score: number; avg_human_score: number | null; deal_count: number; }
interface WeeklyInvested { week_start: string; count: number; }
interface Analytics {
  total_deals: number;
  by_stage: StageCount[];
  invested: number;
  passed: number;
  pass_rate: number | null;
  dwell_time: DwellTime[];
  scorecard_averages: DimAverage[];
  weekly_invested: WeeklyInvested[];
}

const STAGE_LABELS: Record<string, string> = {
  inbox: "Inbox", screening: "Screening", due_diligence: "Due Diligence",
  partner_review: "Partner Review", invested: "Invested", passed: "Passed",
};

const DIM_LABELS: Record<string, string> = {
  team: "Team", market_size: "Market Size", traction: "Traction",
  business_model: "Business Model", competition: "Competition",
  financials: "Financials", overall: "Overall",
};

function ScoreBar({ score, max = 5 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-6 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

function WeeklyChart({ data }: { data: WeeklyInvested[] }) {
  if (data.length === 0) return <p className="text-sm text-gray-400 px-5 py-4">No invested deals yet.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="px-5 py-4">
      <div className="flex items-end gap-1 h-20">
        {data.map((w) => {
          const height = Math.max((w.count / max) * 100, 4);
          return (
            <div key={w.week_start} className="flex-1 flex flex-col items-center gap-1" title={`${w.week_start}: ${w.count}`}>
              <div className="w-full bg-green-400 rounded-t" style={{ height: `${height}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-400">{data[0]?.week_start}</span>
        <span className="text-xs text-gray-400">{data[data.length - 1]?.week_start}</span>
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) redirect("/sign-in");

  let data: Analytics | null = null;
  try {
    data = await apiFetch<Analytics>("/analytics", token);
  } catch {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">Deal outcomes and scoring benchmarks</p>
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Deals", value: data?.total_deals ?? 0 },
            { label: "Invested", value: data?.invested ?? 0 },
            { label: "Passed", value: data?.passed ?? 0 },
            {
              label: "Pass Rate",
              value: data?.pass_rate != null ? `${(data.pass_rate * 100).toFixed(0)}%` : "—",
            },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
              <p className="text-3xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Pipeline funnel */}
          {data && data.by_stage.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3">Pipeline Funnel</h2>
              <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                {data.by_stage.map((s) => (
                  <div key={s.stage} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm">{STAGE_LABELS[s.stage] ?? s.stage}</span>
                    <span className="text-sm font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Avg dwell time per stage */}
          {data && data.dwell_time.length > 0 && (
            <section>
              <h2 className="text-base font-semibold mb-3">Avg Dwell Time per Stage</h2>
              <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                {data.dwell_time.map((d) => (
                  <div key={d.stage} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm">{STAGE_LABELS[d.stage] ?? d.stage}</span>
                    <span className="text-sm font-medium">
                      {d.avg_days < 1
                        ? `${Math.round(d.avg_days * 24)}h`
                        : `${d.avg_days.toFixed(1)}d`}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Weekly invested chart */}
        {data && (
          <section>
            <h2 className="text-base font-semibold mb-3">Invested Deals — Last 12 Weeks</h2>
            <div className="rounded-lg border border-gray-200 bg-white">
              <WeeklyChart data={data.weekly_invested} />
            </div>
          </section>
        )}

        {/* Scorecard averages */}
        {data && data.scorecard_averages.length > 0 && (
          <section>
            <h2 className="text-base font-semibold mb-3">Average Scorecard by Dimension</h2>
            <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
              {data.scorecard_averages.map((d) => (
                <div key={d.dimension_key} className="px-5 py-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{DIM_LABELS[d.dimension_key] ?? d.dimension_key}</span>
                    <span className="text-xs text-gray-400">{d.deal_count} deals</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="w-16">AI score</span>
                      <ScoreBar score={d.avg_ai_score} />
                    </div>
                    {d.avg_human_score != null && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="w-16">Human</span>
                        <ScoreBar score={d.avg_human_score} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
