import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-1.5 bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function WeeklyChart({ data }: { data: WeeklyInvested[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground px-5 py-4">No invested deals yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="px-5 py-4">
      <div className="flex items-end gap-1 h-20">
        {data.map((w) => {
          const height = Math.max((w.count / max) * 100, 4);
          return (
            <div
              key={w.week_start}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${w.week_start}: ${w.count}`}
            >
              <div
                className="w-full bg-primary/70 rounded-t-sm"
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-muted-foreground">{data[0]?.week_start}</span>
        <span className="text-xs text-muted-foreground">{data[data.length - 1]?.week_start}</span>
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

  const stats = [
    { label: "Total Deals", value: data?.total_deals ?? 0 },
    { label: "Invested", value: data?.invested ?? 0 },
    { label: "Passed", value: data?.passed ?? 0 },
    {
      label: "Pass Rate",
      value: data?.pass_rate != null ? `${(data.pass_rate * 100).toFixed(0)}%` : "—",
    },
  ];

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Analytics</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="max-w-5xl space-y-6">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-3xl font-bold mt-1">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {data && data.by_stage.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Pipeline Funnel</CardTitle>
              </CardHeader>
              <Table>
                <TableBody>
                  {data.by_stage.map((s) => (
                    <TableRow key={s.stage}>
                      <TableCell className="text-sm">
                        {STAGE_LABELS[s.stage] ?? s.stage}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {s.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {data && data.dwell_time.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Avg Dwell Time per Stage</CardTitle>
              </CardHeader>
              <Table>
                <TableBody>
                  {data.dwell_time.map((d) => (
                    <TableRow key={d.stage}>
                      <TableCell className="text-sm">
                        {STAGE_LABELS[d.stage] ?? d.stage}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {d.avg_days < 1
                          ? `${Math.round(d.avg_days * 24)}h`
                          : `${d.avg_days.toFixed(1)}d`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        {data && (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold">
                Invested Deals — Last 12 Weeks
              </CardTitle>
            </CardHeader>
            <WeeklyChart data={data.weekly_invested} />
          </Card>
        )}

        {data && data.scorecard_averages.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Average Scorecard by Dimension
              </CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dimension</TableHead>
                  <TableHead>AI Score</TableHead>
                  <TableHead>Human Score</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.scorecard_averages.map((d) => (
                  <TableRow key={d.dimension_key}>
                    <TableCell className="text-sm font-medium">
                      {DIM_LABELS[d.dimension_key] ?? d.dimension_key}
                    </TableCell>
                    <TableCell className="min-w-32">
                      <ScoreBar score={d.avg_ai_score} />
                    </TableCell>
                    <TableCell className="min-w-32">
                      {d.avg_human_score != null
                        ? <ScoreBar score={d.avg_human_score} />
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {d.deal_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
      </div>
    </SidebarInset>
  );
}
