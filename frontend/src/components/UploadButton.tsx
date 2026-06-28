"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPTED = ".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/decks", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(body.detail ?? "Upload failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {uploading ? "Uploading…" : "Upload Deck"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
