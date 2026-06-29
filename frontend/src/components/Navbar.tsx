"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const NAV = [
  { href: "/pipeline", label: "Pipeline" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings/pipeline", label: "Settings" },
];

export function Navbar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/pipeline" className="text-sm font-bold tracking-tight text-gray-900">
            VC Pipeline
          </Link>
          <nav className="flex items-center gap-0.5">
            {NAV.map(({ href, label }) => {
              const root = "/" + href.split("/")[1];
              const active = path === href || path.startsWith(root + "/") || path === root;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-gray-100 text-gray-900 font-medium"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <UserButton />
      </div>
    </header>
  );
}
