import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata = { title: "Security & privacy" };

const sections = [
  {
    title: "What we collect",
    items: [
      "From Claude Enterprise: per-person daily activity counts (messages, conversations, Claude Code sessions, commits, pull requests, lines of code) and cost by product. Matched by work email.",
      "From people themselves: optional check-ins and their ABOUT.md.",
      "From your admins: team, title and seat labels.",
      "We never receive the content of anyone's AI conversations, prompts, files or code.",
    ],
  },
  {
    title: "How twins use it",
    items: [
      "PROGRESS.md is rewritten by Claude after each sync, from check-ins and activity counts only. Every item names its source.",
      "Twins are instructed not to rate performance, effort or character, and not to speculate about personal matters.",
      "Every question asked to a twin is recorded in that person's AUDIT_LOG.md, which they can read.",
      "Admins can stop check-in text from reaching twins entirely (Settings → AI & privacy).",
    ],
  },
  {
    title: "Signing in",
    items: [
      "Sign in with Google, Microsoft, Apple, GitHub or Slack, a passkey, company SSO (OIDC), or email and password.",
      "Company SSO only turns on after the company proves it owns its email domain with a DNS record, so nobody can claim another company's addresses.",
      "Invites and access to your own twin are granted only to verified email addresses.",
    ],
  },
  {
    title: "Your keys",
    items: [
      "Digital Twin is free and never bills you. You bring your own keys, and usage of each key is billed by the provider that issued it.",
      "With a local model (Ollama, LM Studio) and local storage, twin files and questions never leave your machine.",
      "Your Claude Analytics key, Anthropic API key and storage credentials are encrypted at rest with AES-256-GCM.",
      "The Analytics key is read-only (read:analytics scope). It cannot send messages or change your Claude organization.",
      "Keys are never shown again after you save them, and can be removed at any time.",
    ],
  },
  {
    title: "Where files live",
    items: [
      "Built-in: twin files are stored in our database alongside your usage data.",
      "Your bucket: AWS S3 or any S3-compatible service (Cloudflare R2, MinIO). Files are written with your credentials.",
      "Your API: we call four simple HTTPS endpoints on your server with a bearer token. See the storage API docs.",
      "Switching storage tests the new location first, and can copy existing files over.",
    ],
  },
];

export default function Security() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24">
      <h1 className="font-serif text-[44px] leading-tight font-medium tracking-[-0.02em]">Security &amp; privacy</h1>
      <p className="mt-3 max-w-2xl text-[17px] text-text-2">
        Digital Twin tracks how people use AI at work. That only works if it&apos;s fair to them, so here is exactly what we collect and how it&apos;s used.
      </p>
      <div className="mt-12 space-y-5">
        {sections.map((s) => (
          <Card key={s.title} className="p-6">
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-text-2">
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <p className="mt-10 text-sm text-text-3">
        Building your own storage backend? Read the <Link href="/docs/storage-api" className="text-accent underline">storage API contract</Link>.
      </p>
    </div>
  );
}
