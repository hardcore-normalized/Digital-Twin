/** Marketing copy. Digital Twin is free: people bring their own keys. */

export const KEYS = [
  {
    name: "Claude Enterprise Analytics key",
    required: true,
    what: "Imports each person's daily usage and cost.",
    detail: "Read-only (read:analytics). Your organization's Primary Owner creates it in claude.ai → Organization settings → API.",
  },
  {
    name: "AI model key",
    required: false,
    what: "Powers twin chat and the AI-written PROGRESS.md.",
    detail:
      "Any model: Claude, OpenAI, Gemini, OpenRouter or any OpenAI-compatible server, billed by that provider. Or a local model like Ollama or LM Studio, which needs no key.",
  },
  {
    name: "Storage key",
    required: false,
    what: "Keeps twin files on your side.",
    detail: "An S3-compatible bucket, your own storage API (localhost works when self-hosting), or a folder on your server. Otherwise files stay in the app's database.",
  },
];

export const FAQ = [
  {
    q: "How do I get it?",
    a: "Download it from GitHub and run three commands (see Run it yourself above); the install guide on GitHub walks through every step. It runs on your own computer or server, so your data and keys stay with you. Everything is free and open source under the MIT license.",
  },
  {
    q: "Is it really free?",
    a: "Yes. There are no plans, seats, trials or paywalls. You bring your own keys, and any usage of those keys is billed by the provider that issued them, directly to you.",
  },
  {
    q: "Which keys do I need?",
    a: "Three, and only the first is required: a Claude Enterprise Analytics key to import usage, a key for the AI model you want (for twin chat and progress summaries), and a storage key if you want twin files on your side. One AI key covers both chat and summaries. Every key is tested before it's saved, encrypted at rest, and can be removed at any time.",
  },
  {
    q: "Can I use a local model or local storage?",
    a: "Yes, when you run Digital Twin yourself: point it at Ollama or LM Studio on localhost, and keep files in a folder or a storage API on your own machine. They only work while that machine is on. While it's off, usage still imports, twin chat pauses, and PROGRESS.md falls back to a plain summary until it's back.",
  },
  {
    q: "How do people sign in?",
    a: "With Google, Microsoft, Apple, GitHub or Slack, a passkey (Face ID, Touch ID, Windows Hello), company SSO through Okta, Microsoft Entra or Google Workspace, or email and password. Access to a company's zone is only granted to verified email addresses.",
  },
  {
    q: "Does this share one AI subscription between several people?",
    a: "No. Sharing a single personal login breaks most AI providers' terms. Digital Twin works with company plans — like Claude Enterprise — where every person already has their own seat, and shows usage and cost per person.",
  },
  {
    q: "What does a digital twin know about someone?",
    a: "Only what's in their four files: ABOUT.md (written by the person), PROGRESS.md (built from their check-ins and Claude activity counts), USAGE.md (exact numbers) and AUDIT_LOG.md. It never sees the content of their AI conversations.",
  },
  {
    q: "Can people see what their manager asks their twin?",
    a: "Yes. Every question asked to a twin is written to that person's AUDIT_LOG.md, which they can read from their own view. That's deliberate: it keeps the tool fair and builds trust.",
  },
  {
    q: "Where are the twin files stored?",
    a: "In the app's database by default. You can switch to your own S3-compatible bucket or your own HTTP storage API, so the files never rest anywhere you don't control.",
  },
  {
    q: "Which AI providers are supported?",
    a: "Claude Enterprise today, via its Analytics API. More providers are on the roadmap.",
  },
];
