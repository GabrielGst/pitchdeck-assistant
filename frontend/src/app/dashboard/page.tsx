import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LayoutGrid,
  BarChart3,
  Settings,
} from "lucide-react";

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

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  partner: "default",
  associate: "secondary",
  analyst: "outline",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", partner: "Partner", associate: "Associate", analyst: "Analyst",
};

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
      <main className="flex min-h-screen items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Account not provisioned</CardTitle>
            <CardDescription>
              Your account has not been added to a firm yet. Contact your administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
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
    <main className="p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{profile.tenant.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{profile.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={ROLE_VARIANTS[profile.role] ?? "outline"}>
              {ROLE_LABELS[profile.role] ?? profile.role}
            </Badge>
            <UserButton />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
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
                  <CardDescription className="text-xs leading-relaxed">
                    {description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
