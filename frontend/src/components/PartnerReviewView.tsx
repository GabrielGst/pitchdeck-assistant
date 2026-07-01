"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import { useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DealChat } from "@/components/DealChat";
import { AnalystChat } from "@/components/AnalystChat";
import { MemoHighlightToolbar } from "@/components/MemoHighlightToolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Save, Trash2 } from "lucide-react";

// ── Memo text highlighting helpers ──────────────────────────────────────────

function highlightText(text: string, refs: string[]): React.ReactNode {
  if (!refs.length) return text;

  let best: { idx: number; ref: string } | null = null;
  for (const ref of refs) {
    const idx = text.indexOf(ref);
    if (idx !== -1 && (!best || idx < best.idx)) best = { idx, ref };
  }
  if (!best) return text;

  const { idx, ref } = best;
  return (
    <>
      {idx > 0 ? text.slice(0, idx) : null}
      <mark
        className="bg-amber-100 text-amber-900 rounded-sm px-0.5 cursor-pointer"
        title="Referenced in a comment or AI discussion"
      >
        {ref}
      </mark>
      {idx + ref.length < text.length
        ? highlightText(text.slice(idx + ref.length), refs)
        : null}
    </>
  );
}

function processNode(node: React.ReactNode, refs: string[]): React.ReactNode {
  if (typeof node === "string") return highlightText(node, refs);
  if (!React.isValidElement(node)) return node;
  const el = node as React.ReactElement<{ children?: React.ReactNode }>;
  if (el.props.children === undefined) return node;
  if (typeof el.props.children === "string") {
    return React.cloneElement(el, { children: highlightText(el.props.children, refs) });
  }
  if (Array.isArray(el.props.children)) {
    return React.cloneElement(el, {
      children: (el.props.children as React.ReactNode[]).map((c, i) =>
        React.isValidElement(processNode(c, refs))
          ? React.cloneElement(processNode(c, refs) as React.ReactElement, { key: i })
          : processNode(c, refs)
      ),
    });
  }
  return node;
}

// ────────────────────────────────────────────────────────────────────────────

interface PartnerReviewViewProps {
  dealId: string;
}

interface Comment {
  id: string;
  author_id: string | null;
  body: string;
  ai_assisted: boolean;
  context_ref: string | null;
  created_at: string;
}

type ChatMode = "ai" | "analyst";

const RATING_LABELS: Record<string, string> = {
  strong_yes: "Strong Yes",
  yes: "Yes",
  neutral: "Neutral",
  no: "No",
  strong_no: "Strong No",
};

const RATING_COLORS: Record<string, string> = {
  strong_yes: "text-green-700 bg-green-100 border-green-200",
  yes: "text-green-600 bg-green-50 border-green-100",
  neutral: "text-yellow-700 bg-yellow-100 border-yellow-200",
  no: "text-red-600 bg-red-50 border-red-100",
  strong_no: "text-red-700 bg-red-100 border-red-200",
};

export function PartnerReviewView({ dealId }: PartnerReviewViewProps) {
  const [memoText, setMemoText] = useState<string | null>(null);
  const [contextRef, setContextRef] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>("ai");
  const [comments, setComments] = useState<Comment[]>([]);
  const [rating, setRating] = useState<string>("");
  const [savedRating, setSavedRating] = useState<string>("");
  // inline comment state
  const [pendingCommentText, setPendingCommentText] = useState<string | null>(null);
  const [pendingCommentRef, setPendingCommentRef] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  // last AI response for save-as-comment
  const [lastAiResponse, setLastAiResponse] = useState<string | null>(null);
  const [lastAiContextRef, setLastAiContextRef] = useState<string | null>(null);
  const memoRef = useRef<HTMLDivElement>(null);
  const { getToken } = useAuth();

  const highlightRefs = useMemo(
    () =>
      comments
        .map((c) => c.context_ref)
        .filter((r): r is string => !!r && r.length > 4),
    [comments],
  );

  const memoComponents = useMemo(() => {
    if (!highlightRefs.length) return undefined;
    const h = highlightRefs; // capture for closures
    return {
      p({ children }: { children?: React.ReactNode }) {
        return <p>{React.Children.map(children, (c) => processNode(c, h))}</p>;
      },
      li({ children }: { children?: React.ReactNode }) {
        return <li>{React.Children.map(children, (c) => processNode(c, h))}</li>;
      },
      h1({ children }: { children?: React.ReactNode }) {
        return <h1>{React.Children.map(children, (c) => processNode(c, h))}</h1>;
      },
      h2({ children }: { children?: React.ReactNode }) {
        return <h2>{React.Children.map(children, (c) => processNode(c, h))}</h2>;
      },
      h3({ children }: { children?: React.ReactNode }) {
        return <h3>{React.Children.map(children, (c) => processNode(c, h))}</h3>;
      },
    };
  }, [highlightRefs]);

  const loadAnalysis = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`/api/analysis/${dealId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setMemoText(data.partner_memo || data.memo_text || null);
  }, [dealId, getToken]);

  const loadReview = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`/api/deals/${dealId}/review`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setComments(data.comments ?? []);
    const myReview = data.reviews?.[0];
    if (myReview?.rating) {
      setRating(myReview.rating);
      setSavedRating(myReview.rating);
    }
  }, [dealId, getToken]);

  useEffect(() => {
    loadAnalysis();
    loadReview();
  }, [loadAnalysis, loadReview]);

  async function saveRating() {
    if (!rating) return;
    const token = await getToken();
    await fetch(`/api/deals/${dealId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating }),
    });
    setSavedRating(rating);
  }

  async function submitInlineComment() {
    if (!commentInput.trim()) return;
    setSavingComment(true);
    const token = await getToken();
    await fetch(`/api/deals/${dealId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        body: commentInput.trim(),
        ai_assisted: false,
        context_ref: pendingCommentRef,
      }),
    });
    setCommentInput("");
    setPendingCommentText(null);
    setPendingCommentRef(null);
    setSavingComment(false);
    await loadReview();
  }

  async function saveAiResponseAsComment() {
    if (!lastAiResponse) return;
    const token = await getToken();
    await fetch(`/api/deals/${dealId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        body: lastAiResponse,
        ai_assisted: true,
        context_ref: lastAiContextRef,
      }),
    });
    setLastAiResponse(null);
    setLastAiContextRef(null);
    await loadReview();
  }

  async function deleteComment(id: string) {
    const token = await getToken();
    await fetch(`/api/deals/${dealId}/comments/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  function handleHighlightAction({
    type,
    selectedText,
  }: {
    type: "chat-ai" | "comment" | "chat-analyst";
    selectedText: string;
  }) {
    if (type === "chat-ai") {
      setContextRef(selectedText);
      setChatMode("ai");
    } else if (type === "chat-analyst") {
      setContextRef(selectedText);
      setChatMode("analyst");
    } else {
      // inline comment
      setPendingCommentText(selectedText);
      setPendingCommentRef(selectedText);
      setCommentInput("");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 h-full min-h-0">
      {/* ── Left: memo + rating + comments ── */}
      <div className="flex flex-col gap-6 overflow-y-auto">
        {/* Investment memo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Investment Memo</CardTitle>
            <p className="text-xs text-muted-foreground">
              Select text to chat with AI, make a comment, or discuss with an analyst.
            </p>
          </CardHeader>
          <CardContent>
            {memoText ? (
              <>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <div ref={memoRef as any} className="select-text">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-sm leading-relaxed"
                    components={memoComponents}
                  >
                    {memoText}
                  </ReactMarkdown>
                </div>
                <MemoHighlightToolbar
                  containerRef={memoRef}
                  onAction={handleHighlightAction}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No memo available yet. Run the screening analysis first.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Inline comment form */}
        {pendingCommentText && (
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-2">
              <blockquote className="border-l-2 border-primary pl-2 text-xs italic text-muted-foreground line-clamp-2">
                &ldquo;{pendingCommentText}&rdquo;
              </blockquote>
              <Textarea
                autoFocus
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Write your comment…"
                rows={3}
                className="text-sm resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={submitInlineComment} disabled={savingComment || !commentInput.trim()}>
                  <Save className="size-3.5" />
                  {savingComment ? "Saving…" : "Save comment"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setPendingCommentText(null); setPendingCommentRef(null); }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rating */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My Vote</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={rating} onValueChange={(v) => setRating(v ?? "")}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RATING_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={saveRating} disabled={!rating || rating === savedRating}>
                <Save className="size-3.5" />
                Save
              </Button>
              {savedRating && (
                <Badge className={`text-xs ${RATING_COLORS[savedRating] ?? ""}`} variant="outline">
                  {RATING_LABELS[savedRating]}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comments list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Comments
              {comments.length > 0 && (
                <Badge variant="secondary" className="text-xs">{comments.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No comments yet. Select text in the memo to add a comment or save an AI response.
              </p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-md border p-3 text-sm space-y-1.5">
                    {c.context_ref && (
                      <blockquote className="border-l-2 border-muted-foreground/30 pl-2 text-xs italic text-muted-foreground line-clamp-2">
                        &ldquo;{c.context_ref}&rdquo;
                      </blockquote>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{c.body}</p>
                    <div className="flex items-center gap-2 pt-0.5">
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
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Right: AI / analyst chat — sticks below the page header ── */}
      <div className="sticky top-16 h-[calc(100svh-4rem)] flex flex-col gap-3">
        {/* Mode toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setChatMode("ai")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              chatMode === "ai"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            AI Assistant
          </button>
          <button
            onClick={() => setChatMode("analyst")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              chatMode === "analyst"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Analyst Chat
          </button>
        </div>

        <Card className="flex flex-col flex-1 min-h-0">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-sm">
              {chatMode === "ai" ? "AI Partner Assistant" : "Team Discussion"}
            </CardTitle>
            {chatMode === "analyst" && (
              <p className="text-xs text-muted-foreground">
                Shared thread visible to all team members.
              </p>
            )}
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 pb-4">
            {chatMode === "ai" ? (
              <DealChat
                dealId={dealId}
                contextRef={contextRef}
                onContextRefClear={() => setContextRef(null)}
                placeholder="Ask about the memo or deal…"
                showSynthesisButton
                onAssistantResponse={(text) => {
                  setLastAiResponse(text);
                  setLastAiContextRef(contextRef);
                }}
              />
            ) : (
              <AnalystChat
                dealId={dealId}
                contextRef={contextRef}
                onContextRefClear={() => setContextRef(null)}
              />
            )}
          </CardContent>
        </Card>

        {/* Save AI response / synthesis as comment */}
        {lastAiResponse && chatMode === "ai" && (
          <Card className="shrink-0">
            <CardContent className="py-3 px-4">
              <p className="text-xs font-medium mb-1.5">Save as comment</p>
              <p className="text-xs text-muted-foreground line-clamp-3 mb-2 italic">
                {lastAiResponse.slice(0, 200)}{lastAiResponse.length > 200 ? "…" : ""}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={saveAiResponseAsComment}>
                  <MessageSquare className="size-3.5" />
                  Save as comment
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setLastAiResponse(null)}>
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
