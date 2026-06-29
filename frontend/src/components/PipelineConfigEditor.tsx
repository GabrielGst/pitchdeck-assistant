"use client";

import { useState } from "react";

interface CustomStage { key: string; label: string; }

interface PipelineConfig {
  stage_order: string[];
  stage_labels: Record<string, string>;
  custom_stages: CustomStage[];
}

const UNIVERSAL_KEYS = ["inbox", "screening", "due_diligence", "partner_review", "invested", "passed"];
const KEY_RE = /^[a-z][a-z0-9_]{1,49}$/;

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

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
    const res = await fetch(`${apiUrl}/pipeline-config`, {
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

  const DEFAULT_LABELS: Record<string, string> = {
    inbox: "Inbox", screening: "Screening", due_diligence: "Due Diligence",
    partner_review: "Partner Review", invested: "Invested", passed: "Passed",
  };

  return (
    <div className="space-y-8">
      {/* Stage label overrides */}
      <section>
        <h2 className="text-base font-semibold mb-3">Stage Display Names</h2>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {UNIVERSAL_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-4 px-5 py-3">
              <span className="text-xs text-gray-400 w-32 font-mono">{key}</span>
              <input
                className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={labels[key] ?? DEFAULT_LABELS[key] ?? key}
                onChange={(e) => setLabels((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Custom stages */}
      <section>
        <h2 className="text-base font-semibold mb-1">Custom Stages</h2>
        <p className="text-xs text-gray-400 mb-3">
          Up to 3 stages inserted between Partner Review and Invested/Passed.
        </p>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 mb-3">
          {customStages.length === 0 && (
            <p className="text-sm text-gray-400 px-5 py-4">No custom stages configured.</p>
          )}
          {customStages.map((s) => (
            <div key={s.key} className="flex items-center justify-between px-5 py-3">
              <div>
                <span className="text-sm font-medium">{s.label}</span>
                <span className="ml-2 text-xs text-gray-400 font-mono">{s.key}</span>
              </div>
              <button
                onClick={() => removeCustomStage(s.key)}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {customStages.length < 3 && (
          <div className="flex gap-2">
            <input
              placeholder="key (e.g. ic_prep)"
              className="border border-gray-200 rounded px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
            <input
              placeholder="Label (e.g. IC Prep)"
              className="border border-gray-200 rounded px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <button
              onClick={addCustomStage}
              className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-sm font-medium"
            >
              Add
            </button>
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-600">Configuration saved.</p>}

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Configuration"}
      </button>
    </div>
  );
}
