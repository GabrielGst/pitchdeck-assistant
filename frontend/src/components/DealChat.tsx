"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Bot, Send, User } from "lucide-react";

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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  contextRef?: string | null;
}

interface DealChatProps {
  dealId: string;
  contextRef?: string | null;
  onContextRefClear?: () => void;
  placeholder?: string;
  /** Called with the latest assistant response after each stream completes */
  onAssistantResponse?: (text: string) => void;
}

export function DealChat({
  dealId,
  contextRef,
  onContextRefClear,
  placeholder = "Ask a question about this deal…",
  onAssistantResponse,
}: DealChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const { getToken } = useAuth();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getToken();
      const res = await fetch(`/api/deals/${dealId}/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (!res?.ok || cancelled) return;
      const data: ChatMessage[] = await res.json();
      if (!cancelled) setMessages(data);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // Focus input when a contextRef arrives
  useEffect(() => {
    if (contextRef) inputRef.current?.focus();
  }, [contextRef]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setStreaming(true);

    const tempUserId = `tmp-u-${Date.now()}`;
    const tempAsstId = `tmp-a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: text, contextRef },
      { id: tempAsstId, role: "assistant", content: "" },
    ]);
    onContextRefClear?.();

    try {
      const token = await getToken();
      const res = await fetch(`/api/deals/${dealId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, context_ref: contextRef ?? null }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAsstId
              ? { ...m, content: "Error: could not reach the server." }
              : m,
          ),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.text) {
              fullResponse += payload.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAsstId
                    ? { ...m, content: m.content + payload.text }
                    : m,
                ),
              );
            }
            if (payload.message_id) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAsstId ? { ...m, id: payload.message_id } : m,
                ),
              );
            }
            if (payload.detail) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAsstId
                    ? { ...m, content: `Error: ${payload.detail}` }
                    : m,
                ),
              );
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

      if (fullResponse && onAssistantResponse) {
        onAssistantResponse(fullResponse);
      }
    } finally {
      setStreaming(false);
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
      <MessageScrollerProvider>
        <MessageScroller className="flex-1 min-h-0">
          <MessageScrollerViewport>
            <MessageScrollerContent className="px-2 py-4">
              {messages.length === 0 && (
                <Marker variant="separator">
                  <MarkerContent>No messages yet — ask a question to start</MarkerContent>
                </Marker>
              )}

              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const isLastAssistant =
                  !isUser &&
                  i === messages.length - 1;

                return (
                  <MessageScrollerItem
                    key={msg.id}
                    scrollAnchor={isLastAssistant}
                  >
                    <Message align={isUser ? "end" : "start"}>
                      {!isUser && (
                        <MessageAvatar className="size-7 bg-primary/10 text-primary">
                          <Bot className="size-4" />
                        </MessageAvatar>
                      )}
                      <MessageContent>
                        {msg.contextRef && (
                          <Bubble variant="ghost" align={isUser ? "end" : "start"}>
                            <BubbleContent className="text-xs italic text-muted-foreground border-l-2 border-muted-foreground/30 pl-2 py-1 !px-2 !rounded-none">
                              &ldquo;{msg.contextRef.slice(0, 140)}
                              {msg.contextRef.length > 140 ? "…" : ""}&rdquo;
                            </BubbleContent>
                          </Bubble>
                        )}
                        <Bubble
                          variant={isUser ? "default" : "muted"}
                          align={isUser ? "end" : "start"}
                        >
                          <BubbleContent>
                            {msg.content || (
                              <span className="inline-flex gap-1 items-center text-muted-foreground">
                                <span className="animate-bounce delay-0">·</span>
                                <span className="animate-bounce delay-100">·</span>
                                <span className="animate-bounce delay-200">·</span>
                              </span>
                            )}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                      {isUser && (
                        <MessageAvatar className="size-7 bg-muted">
                          <User className="size-4" />
                        </MessageAvatar>
                      )}
                    </Message>
                  </MessageScrollerItem>
                );
              })}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* Context reference pill */}
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

      {/* Input row */}
      <div className="flex gap-2 pt-2 border-t">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          disabled={streaming}
          className="resize-none text-sm"
        />
        <Button
          size="sm"
          onClick={sendMessage}
          disabled={streaming || !input.trim()}
          className="self-end"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
