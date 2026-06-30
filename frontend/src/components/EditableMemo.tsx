"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EditableMemoProps {
  dealId: string;
  initialText: string;
}

const API = "/api";

export function EditableMemo({ dealId, initialText }: EditableMemoProps) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { getToken } = useAuth();

  const save = useCallback(
    async (value: string) => {
      setSaving(true);
      setSaved(false);
      try {
        const token = await getToken();
        await fetch(`${API}/analysis/${dealId}/memo`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ edited_text: value }),
        });
        setSaved(true);
      } finally {
        setSaving(false);
      }
    },
    [dealId, getToken]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => save(value), 2000);
  };

  if (editing) {
    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          className={cn(
            "w-full min-h-96 rounded-lg border bg-card px-6 py-5 font-sans text-sm text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring resize-y",
            "border-primary/40"
          )}
          value={text}
          onChange={handleChange}
          onBlur={() => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            save(text).then(() => setEditing(false));
          }}
          autoFocus
        />
        <div className="flex items-center mt-1.5 text-xs text-muted-foreground">
          {saving && <span>Saving…</span>}
          {!saving && saved && <span className="text-emerald-600">Saved</span>}
          <span className="ml-auto">Click outside to finish</span>
        </div>
      </div>
    );
  }

  return (
    <Card
      className="group cursor-text hover:border-primary/40 transition-colors"
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      <CardContent className="relative pt-5 pb-5">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-sm leading-relaxed"
        >
          {text}
        </ReactMarkdown>
        <span className="absolute top-3 right-3 hidden rounded bg-primary/10 px-2 py-0.5 text-xs text-primary group-hover:block">
          Edit
        </span>
      </CardContent>
    </Card>
  );
}
