"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { AnalysisStream } from "@/components/AnalysisStream";
import { DealChat } from "@/components/DealChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Trash2, Upload, Loader2 } from "lucide-react";

interface DueDiligenceViewProps {
  dealId: string;
}

interface DocumentItem {
  id: string;
  filename: string;
  mime_type: string;
  document_type: string;
  has_text: boolean;
  created_at: string;
}

export function DueDiligenceView({ dealId }: DueDiligenceViewProps) {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { getToken } = useAuth();

  const loadDocs = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`/api/deals/${dealId}/documents`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (res?.ok) {
      const data: DocumentItem[] = await res.json();
      setDocs(data);
    }
  }, [dealId, getToken]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function handleUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const token = await getToken();
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`/api/deals/${dealId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "Upload failed" }));
        const detail = body.detail;
        const message =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((e: { msg?: string }) => e.msg ?? "Unknown error").join(", ")
              : "Upload failed";
        throw new Error(message);
      }
      await loadDocs();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    const token = await getToken();
    await fetch(`/api/deals/${dealId}/documents/${docId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setDocs((prev) => prev.filter((d) => d.id !== docId));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
      {/* Left column: analysis + supplementary docs */}
      <div className="space-y-6">
        <AnalysisStream dealId={dealId} />

        {/* Supplementary documents */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Supplementary Documents</CardTitle>
              <div className="flex flex-col items-end gap-1">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.pptx,.docx,.doc,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
                {uploadError && (
                  <p className="text-xs text-destructive">{uploadError}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No supplementary documents yet. Upload financial models, legal docs, or other materials.
              </p>
            ) : (
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{doc.filename}</span>
                    <Badge variant="secondary" className="text-xs">
                      {doc.document_type}
                    </Badge>
                    {doc.has_text ? (
                      <Badge variant="outline" className="text-xs text-green-600">
                        indexed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        processing…
                      </Badge>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right column: DD chat — fixed height, sticks below the page header */}
      <Card className="sticky top-16 flex flex-col h-[calc(100svh-4rem)]">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-base">Due Diligence Assistant</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ask questions about the deal. Uploaded documents and the screening analysis are included as context.
          </p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 pb-4">
          <DealChat
            dealId={dealId}
            placeholder="Ask a due diligence question…"
          />
        </CardContent>
      </Card>
    </div>
  );
}
