import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { LayoutGrid, BarChart3, Settings } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  tenant: { id: string; name: string; slug: string };
}

interface Analytics {
  total_deals: number;
  invested: number;
  passed: number;
  pass_rate: number | null;
  by_stage: { stage: string; count: number }[];
}

const ACTIONS = [
  {
    href: "/pipeline",
    label: "Deal Pipeline",
    description: "Review incoming decks and advance deals through stages",
    icon: LayoutGrid,
  },
  {
    href: "/analytics",
    label: "Analytics",
    description: "Track funnel performance, scorecard benchmarks, and dwell times",
    icon: BarChart3,
  },
  {
    href: "/settings/pipeline",
    label: "Settings",
    description: "Configure pipeline stages, scorecard dimensions, and investment thesis",
    icon: Settings,
  },
];

export default async function DashboardPage() {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) redirect("/sign-in");

  const [profile, analytics] = await Promise.all([
    apiFetch<UserProfile>("/users/me", token).catch(() => null),
    apiFetch<Analytics>("/analytics", token).catch(() => null),
  ]);

  if (!profile) {
    return (
      <SidebarInset>
        <div className="flex flex-1 items-center justify-center p-8">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Account not provisioned</CardTitle>
              <CardDescription>Contact your administrator.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </SidebarInset>
    );
  }

  const inPipeline = analytics
    ? ["inbox", "screening", "due_diligence", "partner_review"]
        .reduce((n, s) => n + (analytics.by_stage.find((b) => b.stage === s)?.count ?? 0), 0)
    : 0;

  const stats = [
    { label: "Total Deals", value: analytics?.total_deals ?? "—" },
    { label: "In Pipeline", value: inPipeline || "—" },
    { label: "Invested", value: analytics?.invested ?? "—" },
    {
      label: "Pass Rate",
      value: analytics?.pass_rate != null
        ? `${(analytics.pass_rate * 100).toFixed(0)}%`
        : "—",
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
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{profile.tenant.name}</Badge>
          <Badge variant="secondary" className="text-xs capitalize">{profile.role}</Badge>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ACTIONS.map(({ href, label, description, icon: Icon }) => (
            <Link key={href} href={href} className="group block">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <Icon className="h-5 w-5 text-primary mb-1" />
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </SidebarInset>
  );
}
