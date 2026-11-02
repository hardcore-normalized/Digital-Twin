import "server-only";
import { decrypt } from "../crypto";
import { presetById, type AiPreset } from "./presets";

export type AiConfig = {
  preset: AiPreset;
  kind: "anthropic" | "openai";
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
  /** "zone": brought by the company. "server": the optional server-wide default (self-hosting). */
  source: "zone" | "server";
};

type ZoneAi = { aiProvider: string; aiBaseUrl: string | null; aiKeyEnc: string | null; aiModel: string };

/** The zone's own AI settings, or the server default for Claude, or null when no model is set up. */
export function aiConfigFor(zone: ZoneAi): AiConfig | null {
  const preset = presetById(zone.aiProvider);
  if (preset.kind === "anthropic") {
    if (zone.aiKeyEnc) return { preset, kind: "anthropic", baseUrl: null, apiKey: decrypt(zone.aiKeyEnc), model: zone.aiModel, source: "zone" };
    if (process.env.ANTHROPIC_API_KEY)
      return { preset, kind: "anthropic", baseUrl: null, apiKey: process.env.ANTHROPIC_API_KEY, model: zone.aiModel, source: "server" };
    return null;
  }
  if (!zone.aiBaseUrl || !zone.aiModel) return null;
  return {
    preset,
    kind: "openai",
    baseUrl: zone.aiBaseUrl,
    apiKey: zone.aiKeyEnc ? decrypt(zone.aiKeyEnc) : null,
    model: zone.aiModel,
    source: "zone",
  };
}

export function aiSource(zone: ZoneAi) {
  return aiConfigFor(zone)?.source ?? null;
}

/** Short human label, e.g. "Ollama (local model) · llama3.1". */
export function describeAi(zone: ZoneAi) {
  const cfg = aiConfigFor(zone);
  return cfg ? `${cfg.preset.label} · ${cfg.model}` : null;
}
