"use client";

import { useState } from "react";
import { Cpu, Laptop } from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import { AI_PRESETS, presetById, type AiPresetId } from "@/lib/ai/presets";
import { useFormAction } from "./action-form";
import { Button, Field, Input, Select, cn } from "./ui";

export function AiForm({
  action,
  current,
  localAllowed,
  serverKeyAvailable,
  showCheckins = true,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  current: { preset: string; baseUrl: string | null; model: string; hasKey: boolean; includeCheckins: boolean };
  localAllowed: boolean;
  serverKeyAvailable: boolean;
  showCheckins?: boolean;
}) {
  const [presetId, setPresetId] = useState<AiPresetId>(presetById(current.preset).id);
  const [state, onSubmit, pending] = useFormAction(action);
  const preset = presetById(presetId);
  const same = presetId === current.preset;
  const keyPlaceholder = same && current.hasKey ? "•••••••••••• (saved — paste a new one to replace it)" : preset.keyHint;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="preset" value={presetId} />
      <div className="grid gap-2 sm:grid-cols-2">
        {AI_PRESETS.map((p) => {
          const disabled = p.local && !localAllowed;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => setPresetId(p.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                presetId === p.id ? "border-accent bg-accent-soft/50 font-medium" : "border-border hover:bg-card-muted",
              )}
              title={disabled ? "Local models are turned off on this server" : undefined}
            >
              {p.local ? <Laptop size={16} className="text-text-3" /> : <Cpu size={16} className="text-text-3" />}
              <span className="flex-1">{p.label}</span>
              {current.preset === p.id && <span className="text-[11px] text-text-3">current</span>}
            </button>
          );
        })}
      </div>

      {preset.kind === "anthropic" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="API key" hint={serverKeyAvailable && !current.hasKey ? "optional — this server has a default key" : undefined}>
            <Input name="apiKey" type="password" autoComplete="off" placeholder={keyPlaceholder} />
          </Field>
          <Field label="Model">
            <Select name="model" defaultValue={same ? current.model : preset.defaultModel} key={presetId}>
              {preset.models!.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </Select>
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2" key={presetId}>
          <Field label="Server address" hint={preset.local ? "on the machine that runs Digital Twin" : undefined}>
            <Input name="baseUrl" defaultValue={same && current.baseUrl ? current.baseUrl : preset.baseUrl} placeholder="https://… or http://localhost:…/v1" required />
          </Field>
          <Field label="Model">
            <Input name="model" defaultValue={same ? current.model : ""} placeholder={preset.modelHint} required />
          </Field>
          <Field label="API key" hint={preset.keyRequired ? undefined : "optional"}>
            <Input name="apiKey" type="password" autoComplete="off" placeholder={keyPlaceholder} />
          </Field>
        </div>
      )}

      {preset.local && (
        <p className="rounded-lg bg-card-muted px-3 py-2.5 text-[13px] text-text-2">
          A local model runs on the machine that runs Digital Twin, so it only answers while that machine is on and the model is running.
          While it&apos;s off, twin chat pauses and PROGRESS.md falls back to a plain summary. Usage still imports.
        </p>
      )}

      {showCheckins && (
        <label className="flex items-start gap-2.5 rounded-lg border border-border p-3.5 text-sm">
          <input type="checkbox" name="includeCheckins" defaultChecked={current.includeCheckins} className="mt-0.5 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">Let twins read check-in text</span>
            <span className="mt-0.5 block text-[13px] text-text-2">When off, twins and admins only see that a check-in happened. People can always read their own.</span>
          </span>
        </label>
      )}
      {!showCheckins && current.includeCheckins && <input type="hidden" name="includeCheckins" value="on" />}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Testing the model…" : "Test and save"}</Button>
        {state?.message && <span className={cn("text-sm", state.ok ? "text-ok" : "text-danger")}>{state.message}</span>}
      </div>
    </form>
  );
}
