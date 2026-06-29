import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

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

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  partner: "bg-blue-100 text-blue-800",
  associate: "bg-green-100 text-green-800",
  analyst: "bg-gray-100 text-gray-700",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", partner: "Partner", associate: "Associate", analyst: "Analyst",
};

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
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">Account not provisioned</h1>
          <p className="text-gray-500 text-sm">
            Your account has not been added to a firm yet. Contact your administrator.
          </p>
        </div>
      </main>
    );
  }

  const inPipeline = analytics
    ? (analytics.by_stage.find((s) => s.stage === "inbox")?.count ?? 0) +
      (analytics.by_stage.find((s) => s.stage === "screening")?.count ?? 0) +
      (analytics.by_stage.find((s) => s.stage === "due_diligence")?.count ?? 0) +
      (analytics.by_stage.find((s) => s.stage === "partner_review")?.count ?? 0)
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

  const actions = [
    {
      href: "/pipeline",
      label: "Deal Pipeline",
      description: "Review incoming decks, advance deals through stages",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
        </svg>
      ),
    },
    {
      href: "/analytics",
      label: "Analytics",
      description: "Track funnel performance, scorecard benchmarks, and dwell times",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      ),
    },
    {
      href: "/settings/pipeline",
      label: "Settings",
      description: "Configure pipeline stages, scorecard dimensions, and investment thesis",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      ),
    },
  ];

  return (
    <main className="p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{profile.tenant.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{profile.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[profile.role] ?? ROLE_COLORS.analyst}`}>
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
            <UserButton />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
              <p className="text-3xl font-bold mt-1 text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {actions.map(({ href, label, description, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow group"
            >
              <span className="text-blue-600 group-hover:text-blue-700 transition-colors">
                {icon}
              </span>
              <div>
                <p className="font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
