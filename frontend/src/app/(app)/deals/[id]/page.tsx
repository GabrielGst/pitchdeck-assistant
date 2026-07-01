import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AnalysisStream } from "@/components/AnalysisStream";
import { InboxView } from "@/components/InboxView";
import { DueDiligenceView } from "@/components/DueDiligenceView";
import { PartnerReviewView } from "@/components/PartnerReviewView";
import { OutcomeActions } from "@/components/OutcomeActions";
import { StageSelector } from "@/components/StageSelector";
import { apiFetch } from "@/lib/api";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  BookOpen,
  ClipboardList,
  FileSearch,
  LayoutDashboard,
} from "lucide-react";

type Section = "overview" | "screening" | "due_diligence" | "partner_review";

interface DealDetail {
  id: string;
  company_name: string;
  stage: string;
  deck_status: string;
}

interface TriageData {
  company: string;
  sector: string;
  funding_stage: string;
  key_metrics: string[];
  thesis_fit: "strong" | "moderate" | "weak" | "unknown";
  thesis_fit_reason: string;
  summary: string;
}

const NAV_ITEMS: { key: Section; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: "overview",        label: "Overview",       icon: LayoutDashboard },
  { key: "screening",       label: "Screening",      icon: BookOpen },
  { key: "due_diligence",   label: "Due Diligence",  icon: FileSearch },
  { key: "partner_review",  label: "Partner Review", icon: ClipboardList },
];

function defaultSection(stage: string): Section {
  if (stage === "inbox") return "overview";
  if (stage === "screening") return "screening";
  if (stage === "due_diligence") return "due_diligence";
  if (stage === "partner_review" || stage === "invested" || stage === "passed")
    return "partner_review";
  return "screening";
}

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const { section: sectionParam } = await searchParams;
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) redirect("/sign-in");

  let deal: DealDetail | null = null;
  try {
    deal = await apiFetch<DealDetail>(`/deals/${id}`, token);
  } catch {
    redirect("/pipeline");
  }

  let triage: TriageData | null = null;
  if (deal.stage === "inbox") {
    try {
      triage = await apiFetch<TriageData>(`/deals/${id}/triage`, token);
    } catch {
      // triage not ready yet — InboxView handles the null case
    }
  }

  const activeSection = (sectionParam as Section | undefined) ?? defaultSection(deal.stage);

  function sectionContent() {
    switch (activeSection) {
      case "overview":
        return (
          <InboxView
            dealId={id}
            companyName={deal!.company_name}
            triage={triage}
            deckStatus={deal!.deck_status}
          />
        );
      case "screening":
        return (
          <div className="max-w-4xl">
            <AnalysisStream dealId={id} />
          </div>
        );
      case "due_diligence":
        return <DueDiligenceView dealId={id} />;
      case "partner_review":
        return <PartnerReviewView dealId={id} />;
    }
  }

  return (
    <SidebarInset>
      {/* Top header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/pipeline">Pipeline</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{deal.company_name}</BreadcrumbPage>
            </BreadcrumbItem>
            {activeSection !== "overview" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="capitalize">
                    {activeSection.replace("_", " ")}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-3">
          <StageSelector dealId={deal.id} currentStage={deal.stage} />
          <OutcomeActions dealId={deal.id} currentStage={deal.stage} />
        </div>
      </header>

      {/* Inner sidebar-13 layout: secondary nav + content */}
      <SidebarProvider
        style={{ "--sidebar-width": "13rem" } as React.CSSProperties}
        className="flex-1 min-h-0 items-start"
      >
        <Sidebar
          collapsible="none"
          className="hidden md:flex sticky top-16 h-[calc(100svh-4rem)] border-r"
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
                    <SidebarMenuItem key={key}>
                      <SidebarMenuButton
                        render={<Link href={`/deals/${id}?section=${key}`} />}
                        isActive={activeSection === key}
                        className="gap-2"
                      >
                        <Icon className="size-4" />
                        {label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-1 flex-col p-6">
          {sectionContent()}
        </div>
      </SidebarProvider>
    </SidebarInset>
  );
}
