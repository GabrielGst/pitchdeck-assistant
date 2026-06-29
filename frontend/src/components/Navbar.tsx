"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const NAV = [
  { href: "/pipeline", label: "Pipeline" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings/pipeline", label: "Settings" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-6 px-6">
        <Link href="/dashboard" className="text-sm font-semibold text-foreground tracking-tight">
          VC Pipeline
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <UserButton />
        </div>
      </div>
      <Separator />
    </header>
  );
}
