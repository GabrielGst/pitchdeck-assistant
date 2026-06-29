"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";

interface CustomStage { key: string; label: string; }

interface PipelineConfig {
  stage_order: string[];
  stage_labels: Record<string, string>;
  custom_stages: CustomStage[];
}

const UNIVERSAL_KEYS = ["inbox", "screening", "due_diligence", "partner_review", "invested", "passed"];
const KEY_RE = /^[a-z][a-z0-9_]{1,49}$/;

const DEFAULT_LABELS: Record<string, string> = {
  inbox: "Inbox", screening: "Screening", due_diligence: "Due Diligence",
  partner_review: "Partner Review", invested: "Invested", passed: "Passed",
};

interface Props {
  initialConfig: PipelineConfig;
  token: string;
}

export function PipelineConfigEditor({ initialConfig, token }: Props) {
  const [labels, setLabels] = useState<Record<string, string>>(initialConfig.stage_labels);
  const [customStages, setCustomStages] = useState<CustomStage[]>(initialConfig.custom_stages);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function addCustomStage() {
    const key = newKey.trim();
    const label = newLabel.trim();
    if (!key || !label) return;
    if (!KEY_RE.test(key)) { setError("Key must be lowercase snake_case (e.g. ic_prep)"); return; }
    if (UNIVERSAL_KEYS.includes(key)) { setError("That key is reserved"); return; }
    if (customStages.length >= 3) { setError("Maximum 3 custom stages"); return; }
    if (customStages.some((s) => s.key === key)) { setError("Key already exists"); return; }
    setCustomStages((prev) => [...prev, { key, label }]);
    setNewKey("");
    setNewLabel("");
    setError(null);
  }

  function removeCustomStage(key: string) {
    setCustomStages((prev) => prev.filter((s) => s.key !== key));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    const stageLabels: Record<string, string> = {};
    for (const k of UNIVERSAL_KEYS) {
      if (labels[k] && labels[k] !== initialConfig.stage_labels[k]) {
        stageLabels[k] = labels[k];
      }
    }
    const res = await fetch("/api/pipeline-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stage_labels: stageLabels, custom_stages: customStages }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.detail ?? "Failed to save configuration");
      return;
    }
    setSuccess(true);
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold mb-3 text-foreground">Stage Display Names</h2>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {UNIVERSAL_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-4 px-5 py-3">
                <span className="text-xs text-muted-foreground w-32 font-mono shrink-0">{key}</span>
                <Input
                  className="flex-1"
                  value={labels[key] ?? DEFAULT_LABELS[key] ?? key}
                  onChange={(e) => setLabels((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section>
        <h2 className="text-sm font-semibold mb-1 text-foreground">Custom Stages</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Up to 3 stages inserted between Partner Review and terminal states.
        </p>
        <Card className="mb-3">
          <CardContent className="p-0 divide-y divide-border">
            {customStages.length === 0 && (
              <p className="text-sm text-muted-foreground px-5 py-4">No custom stages configured.</p>
            )}
            {customStages.map((s) => (
              <div key={s.key} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{s.key}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCustomStage(s.key)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
        {customStages.length < 3 && (
          <div className="flex gap-2">
            <Input
              placeholder="key (e.g. ic_prep)"
              className="w-40 font-mono text-sm"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomStage()}
            />
            <Input
              placeholder="Label (e.g. IC Prep)"
              className="flex-1"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomStage()}
            />
            <Button variant="outline" size="sm" onClick={addCustomStage}>
              Add
            </Button>
          </div>
        )}
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Configuration saved.</p>}

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save Configuration"}
      </Button>
    </div>
  );
}
