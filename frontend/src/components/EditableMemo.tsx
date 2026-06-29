"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";

interface EditableMemoProps {
  dealId: string;
  initialText: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";

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

  return (
    <div className="relative">
      {editing ? (
        <>
          <textarea
            ref={textareaRef}
            className="w-full min-h-[400px] rounded-lg border border-blue-300 bg-white p-6 font-sans text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
            value={text}
            onChange={handleChange}
            onBlur={() => {
              if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
              save(text).then(() => setEditing(false));
            }}
            autoFocus
          />
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            {saving && <span>Saving…</span>}
            {!saving && saved && <span className="text-green-600">Saved</span>}
            <span className="ml-auto">Click outside to finish</span>
          </div>
        </>
      ) : (
        <div
          className="group relative cursor-text rounded-lg border border-gray-200 bg-white p-6 hover:border-blue-300 transition-colors"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">{text}</pre>
          <span className="absolute top-2 right-2 hidden rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600 group-hover:block">
            Edit
          </span>
        </div>
      )}
    </div>
  );
}
