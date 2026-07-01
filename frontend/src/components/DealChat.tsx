"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, User, X } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  contextRef?: string | null;
}

interface DealChatProps {
  dealId: string;
  initialMessages?: Message[];
  contextRef?: string | null;
  onContextRefClear?: () => void;
  placeholder?: string;
}

export function DealChat({
  dealId,
  initialMessages = [],
  contextRef,
  onContextRefClear,
  placeholder = "Ask a question about this deal…",
}: DealChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { getToken } = useAuth();

  // Load history on mount
  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      const token = await getToken();
      const res = await fetch(`/api/deals/${dealId}/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (!res?.ok || cancelled) return;
      const data: Message[] = await res.json();
      if (!cancelled) setMessages(data);
    }
    loadHistory();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setStreaming(true);

    const tempUserId = `tmp-${Date.now()}`;
    const tempAsstId = `tmp-asst-${Date.now()}`;

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
            m.id === tempAsstId ? { ...m, content: "Error: could not reach the server." } : m,
          ),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

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
    <div className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 pr-1">
        <div className="space-y-4 p-1">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet. Ask a question to get started.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mt-1 shrink-0 rounded-full bg-primary/10 p-1">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.contextRef && (
                  <p className="mb-1.5 text-xs italic opacity-70 border-l-2 border-current pl-2">
                    &ldquo;{msg.contextRef.slice(0, 120)}
                    {msg.contextRef.length > 120 ? "…" : ""}&rdquo;
                  </p>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="mt-1 shrink-0 rounded-full bg-muted p-1">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {contextRef && (
        <div className="mx-1 mb-2 flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs">
          <span className="flex-1 italic text-muted-foreground line-clamp-2">
            &ldquo;{contextRef}&rdquo;
          </span>
          <button
            onClick={onContextRefClear}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t mt-2">
        <Textarea
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
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {streaming && (
        <p className="mt-1 text-xs text-muted-foreground">AI is thinking…</p>
      )}
    </div>
  );
}
