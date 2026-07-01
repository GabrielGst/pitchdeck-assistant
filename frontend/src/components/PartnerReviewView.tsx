"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { DealChat } from "@/components/DealChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Save, Trash2, User } from "lucide-react";

interface PartnerReviewViewProps {
  dealId: string;
}

interface ReviewData {
  id: string;
  reviewer_id: string;
  rating: string | null;
  summary: string | null;
  updated_at: string;
}

interface Comment {
  id: string;
  author_id: string | null;
  body: string;
  ai_assisted: boolean;
  context_ref: string | null;
  created_at: string;
}

const RATING_LABELS: Record<string, string> = {
  strong_yes: "Strong Yes",
  yes: "Yes",
  neutral: "Neutral",
  no: "No",
  strong_no: "Strong No",
};

const RATING_COLORS: Record<string, string> = {
  strong_yes: "text-green-700 bg-green-100",
  yes: "text-green-600 bg-green-50",
  neutral: "text-yellow-700 bg-yellow-100",
  no: "text-red-600 bg-red-50",
  strong_no: "text-red-700 bg-red-100",
};

export function PartnerReviewView({ dealId }: PartnerReviewViewProps) {
  const [memoText, setMemoText] = useState<string | null>(null);
  const [contextRef, setContextRef] = useState<string | null>(null);
  const [pendingComment, setPendingComment] = useState<string | null>(null);
  const [myReview, setMyReview] = useState<ReviewData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [rating, setRating] = useState<string>("");
  const { getToken } = useAuth();

  const loadAnalysis = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`/api/analysis/${dealId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      const text = data.partner_memo || data.memo_text;
      setMemoText(text ?? null);
    }
  }, [dealId, getToken]);

  const loadReview = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`/api/deals/${dealId}/review`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setComments(data.comments ?? []);
      if (data.reviews?.length > 0) {
        setMyReview(data.reviews[0]);
        setRating(data.reviews[0].rating ?? "");
      }
    }
  }, [dealId, getToken]);

  useEffect(() => {
    loadAnalysis();
    loadReview();
  }, [loadAnalysis, loadReview]);

  function handleTextSelect() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (text.length > 10) {
      setContextRef(text);
    }
  }

  async function saveRating() {
    if (!rating) return;
    const token = await getToken();
    const res = await fetch(`/api/deals/${dealId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rating }),
    });
    if (res.ok) {
      const data = await res.json();
      setMyReview(data);
    }
  }

  async function saveAsComment(body: string, aiAssisted: boolean, ref: string | null) {
    const token = await getToken();
    const res = await fetch(`/api/deals/${dealId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ body, ai_assisted: aiAssisted, context_ref: ref }),
    });
    if (res.ok) {
      await loadReview();
    }
  }

  async function deleteComment(commentId: string) {
    const token = await getToken();
    await fetch(`/api/deals/${dealId}/comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
      {/* Left column: memo + rating + comments */}
      <div className="space-y-6">
        {/* Investment memo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Investment Memo</CardTitle>
            <p className="text-xs text-muted-foreground">
              Select text to discuss it with the AI.
            </p>
          </CardHeader>
          <CardContent>
            {memoText ? (
              <div
                onMouseUp={handleTextSelect}
                className="prose prose-sm max-w-none text-sm leading-relaxed select-text cursor-text whitespace-pre-wrap"
              >
                {memoText}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No memo available yet. Run the screening analysis first.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Rating */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">My Vote</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Select value={rating} onValueChange={(v) => setRating(v ?? "")}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RATING_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={saveRating} disabled={!rating}>
                <Save className="h-4 w-4" />
                Save
              </Button>
              {myReview?.rating && (
                <Badge
                  className={`text-xs ${RATING_COLORS[myReview.rating] ?? ""}`}
                  variant="outline"
                >
                  {RATING_LABELS[myReview.rating]}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Comments
              {comments.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {comments.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No comments yet. Chat with the AI about the memo and save responses as comments.
              </p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-md border p-3 text-sm space-y-1">
                    {c.context_ref && (
                      <blockquote className="border-l-2 border-muted-foreground/40 pl-2 text-xs italic text-muted-foreground line-clamp-2">
                        &ldquo;{c.context_ref}&rdquo;
                      </blockquote>
                    )}
                    <p className="whitespace-pre-wrap">{c.body}</p>
                    <div className="flex items-center gap-2 pt-1">
                      {c.ai_assisted && (
                        <Badge variant="secondary" className="text-xs">AI-assisted</Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right column: AI chat */}
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col" style={{ minHeight: "600px" }}>
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="text-base">Partner Review Assistant</CardTitle>
            <p className="text-xs text-muted-foreground">
              Select text in the memo to discuss it. Save AI responses as comments.
            </p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            <DealChat
              dealId={dealId}
              contextRef={contextRef}
              onContextRefClear={() => setContextRef(null)}
              placeholder="Ask about the memo or deal…"
            />
          </CardContent>
        </Card>

        {/* Quick-save last AI message as comment */}
        <SaveLastResponseButton
          dealId={dealId}
          contextRef={contextRef}
          onSaved={loadReview}
        />
      </div>
    </div>
  );
}

function SaveLastResponseButton({
  dealId,
  contextRef,
  onSaved,
}: {
  dealId: string;
  contextRef: string | null;
  onSaved: () => void;
}) {
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { getToken } = useAuth();

  // Poll latest assistant message from chat history
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getToken();
      const res = await fetch(`/api/deals/${dealId}/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (!res?.ok || cancelled) return;
      const msgs: { role: string; content: string }[] = await res.json();
      const last = [...msgs].reverse().find((m) => m.role === "assistant");
      if (!cancelled) setLastResponse(last?.content ?? null);
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  if (!lastResponse) return null;

  async function save() {
    if (!lastResponse) return;
    setSaving(true);
    const token = await getToken();
    await fetch(`/api/deals/${dealId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ body: lastResponse, ai_assisted: true, context_ref: contextRef }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground mb-2 font-medium">
          Save last AI response as a comment?
        </p>
        <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{lastResponse}</p>
        <Button size="sm" variant="outline" onClick={save} disabled={saving}>
          <MessageSquare className="h-4 w-4" />
          {saving ? "Saving…" : "Save as comment"}
        </Button>
      </CardContent>
    </Card>
  );
}
