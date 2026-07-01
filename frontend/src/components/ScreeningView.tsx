"use client";

import { useRef, useState } from "react";
import { AnalysisStream } from "@/components/AnalysisStream";
import { DealChat } from "@/components/DealChat";
import { MemoHighlightToolbar } from "@/components/MemoHighlightToolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ScreeningView({ dealId }: { dealId: string }) {
  const [contextRef, setContextRef] = useState<string | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
      {/* Left: analysis with AI-only highlight toolbar */}
      <div ref={analysisRef} className="space-y-6">
        <AnalysisStream dealId={dealId} />
        <MemoHighlightToolbar
          containerRef={analysisRef}
          allowedActions={["chat-ai"]}
          onAction={({ selectedText }) => setContextRef(selectedText)}
        />
      </div>

      {/* Right: AI chat — fixed height, sticks below the page header */}
      <Card className="sticky top-16 flex flex-col h-[calc(100svh-4rem)]">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-base">Screening Assistant</CardTitle>
          <p className="text-xs text-muted-foreground">
            Select text from the analysis to ask about it, or type any question.
          </p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 pb-4">
          <DealChat
            dealId={dealId}
            contextRef={contextRef}
            onContextRefClear={() => setContextRef(null)}
            placeholder="Ask about the deck or analysis…"
          />
        </CardContent>
      </Card>
    </div>
  );
}
