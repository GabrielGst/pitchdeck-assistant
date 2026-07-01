"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Bubble,
  BubbleContent,
} from "@/components/ui/bubble";
import {
  Marker,
  MarkerContent,
} from "@/components/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";

interface TeamMessage {
  id: string;
  author_id: string | null;
  body: string;
  context_ref: string | null;
  created_at: string;
}

interface AnalystChatProps {
  dealId: string;
  contextRef?: string | null;
  onContextRefClear?: () => void;
}

export function AnalystChat({
  dealId,
  contextRef,
  onContextRefClear,
}: AnalystChatProps) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const { getToken } = useAuth();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`/api/deals/${dealId}/review`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    const all: (TeamMessage & { ai_assisted: boolean })[] = data.comments ?? [];
    setMessages(all.filter((c) => !c.ai_assisted));
  }, [dealId, getToken]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (contextRef) inputRef.current?.focus();
  }, [contextRef]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/deals/${dealId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          body: text,
          ai_assisted: false,
          context_ref: contextRef ?? null,
        }),
      });
      if (res.ok) {
        setInput("");
        onContextRefClear?.();
        await loadMessages();
      }
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-full flex-col min-h-0">
      <div className="flex flex-1 flex-col min-h-0">
        <MessageScrollerProvider>
          <MessageScroller className="h-full min-h-0">
            <MessageScrollerViewport>
              <MessageScrollerContent className="px-2 py-4">
                {messages.length === 0 && (
                  <Marker variant="separator">
                    <MarkerContent>No messages yet — start the discussion</MarkerContent>
                  </Marker>
                )}
                {messages.map((msg, i) => (
                  <MessageScrollerItem
                    key={msg.id}
                    scrollAnchor={i === messages.length - 1}
                  >
                    <Message align="start">
                      <MessageAvatar className="size-7 bg-muted text-muted-foreground">
                        <Users className="size-4" />
                      </MessageAvatar>
                      <MessageContent>
                        {msg.context_ref && (
                          <Bubble variant="ghost" align="start">
                            <BubbleContent className="text-xs italic text-muted-foreground border-l-2 border-muted-foreground/30 pl-2 py-1 !px-2 !rounded-none">
                              &ldquo;{msg.context_ref.slice(0, 140)}
                              {msg.context_ref.length > 140 ? "…" : ""}&rdquo;
                            </BubbleContent>
                          </Bubble>
                        )}
                        <Bubble variant="muted" align="start">
                          <BubbleContent className="whitespace-pre-wrap">{msg.body}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      {contextRef && (
        <div className="mx-2 mb-2 flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs">
          <span className="flex-1 italic text-muted-foreground line-clamp-2">
            &ldquo;{contextRef}&rdquo;
          </span>
          <button
            onClick={onContextRefClear}
            className="shrink-0 text-muted-foreground hover:text-foreground leading-none mt-0.5"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the team…"
          rows={2}
          disabled={sending}
          className="resize-none text-sm"
        />
        <Button
          size="sm"
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="self-end"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
