import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  partner: "Partner",
  associate: "Associate",
  analyst: "Analyst",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  partner: "bg-blue-100 text-blue-800",
  associate: "bg-green-100 text-green-800",
  analyst: "bg-gray-100 text-gray-700",
};

interface UserProfile {
  id: string;
  email: string;
  role: string;
  tenant: { id: string; name: string; slug: string };
}

async function fetchUserProfile(token: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(
      `${process.env.API_URL ?? "http://backend:8000"}/users/me`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const { getToken } = await auth();
  const token = await getToken();
  const profile = token ? await fetchUserProfile(token) : null;

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">Account not provisioned</h1>
          <p className="text-gray-500">
            Your account has not been added to a firm yet. Contact your
            administrator to complete setup.
          </p>
        </div>
      </main>
    );
  }

  const roleColor = ROLE_COLORS[profile.role] ?? ROLE_COLORS.analyst;
  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{profile.tenant.name}</h1>
            <p className="text-gray-500 text-sm">{profile.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleColor}`}
            >
              {roleLabel}
            </span>
            <UserButton />
          </div>
        </div>

        {/* Quick nav stubs — filled in by subsequent issues */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Deal Pipeline", href: "/pipeline", issue: 3 },
            { label: "Upload Deck", href: "/upload", issue: 3 },
            { label: "Settings", href: "/settings", issue: 4 },
          ].map(({ label, href, issue }) => (
            <a
              key={href}
              href={href}
              className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="font-medium">{label}</p>
              <p className="text-xs text-gray-400 mt-1">Coming in issue #{issue}</p>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
