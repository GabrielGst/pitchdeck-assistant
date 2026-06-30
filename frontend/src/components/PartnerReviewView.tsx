"use client";

import { AnalysisStream } from "@/components/AnalysisStream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface PartnerReviewViewProps {
  dealId: string;
}

function ComingSoon({ title }: { title: string }) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
          <Construction className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Coming in a future release.</p>
      </CardContent>
    </Card>
  );
}

export function PartnerReviewView({ dealId }: PartnerReviewViewProps) {
  return (
    <div className="max-w-4xl space-y-8">
      <AnalysisStream dealId={dealId} />
      <ComingSoon title="Partner review" />
      <ComingSoon title="Discussion" />
    </div>
  );
}
