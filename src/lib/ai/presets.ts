/** AI providers a zone can bring. Safe to import on the client (no secrets). */

export type AiPresetId = "anthropic" | "openai" | "gemini" | "openrouter" | "ollama" | "lmstudio" | "custom";

export type AiPreset = {
  id: AiPresetId;
  label: string;
  /** "anthropic" uses the official Anthropic SDK; everything else speaks the OpenAI-compatible API. */
  kind: "anthropic" | "openai";
  baseUrl: string;
  keyRequired: boolean;
  keyHint: string;
  modelHint: string;
  /** Runs on a machine you control (needs local endpoints allowed on this server). */
  local?: boolean;
  models?: { id: string; label: string }[];
  defaultModel?: string;
};

export const AI_PRESETS: AiPreset[] = [
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    kind: "anthropic",
    baseUrl: "",
    keyRequired: true,
    keyHint: "sk-ant-… from platform.claude.com",
    modelHint: "",
    models: [
      { id: "claude-opus-5-5", label: "Claude Opus 5.5 — best answers (default)" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — faster, lower cost" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 — fastest, lowest cost" },
    ],
    defaultModel: "claude-opus-5-5",
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    keyRequired: true,
    keyHint: "from platform.openai.com",
    modelHint: "Model name as OpenAI lists it",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    kind: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    keyRequired: true,
    keyHint: "from Google AI Studio",
    modelHint: "Model name as Google lists it",
  },
  {
    id: "openrouter",
    label: "OpenRouter (hundreds of models)",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    keyRequired: true,
    keyHint: "from openrouter.ai/keys",
    modelHint: "e.g. provider/model-name from openrouter.ai/models",
  },
  {
    id: "ollama",
    label: "Ollama (local model)",
    kind: "openai",
    baseUrl: "http://localhost:11434/v1",
    keyRequired: false,
    keyHint: "not needed",
    modelHint: "A model you've pulled — see `ollama list`",
    local: true,
  },
  {
    id: "lmstudio",
    label: "LM Studio (local model)",
    kind: "openai",
    baseUrl: "http://localhost:1234/v1",
    keyRequired: false,
    keyHint: "not needed",
    modelHint: "The model id shown in LM Studio's server tab",
    local: true,
  },
  {
    id: "custom",
    label: "Other OpenAI-compatible server",
    kind: "openai",
    baseUrl: "",
    keyRequired: false,
    keyHint: "if your server needs one",
    modelHint: "Model name your server expects",
  },
];

export const presetById = (id: string) => AI_PRESETS.find((p) => p.id === id) ?? AI_PRESETS[0];
