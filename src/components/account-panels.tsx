"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Fingerprint, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AppleIcon, GitHubIcon, GoogleIcon, MicrosoftIcon, SlackIcon } from "./brand-icons";
import { Button, cn } from "./ui";

const ICONS: Record<string, ReactNode> = {
  google: <GoogleIcon />,
  microsoft: <MicrosoftIcon />,
  apple: <AppleIcon />,
  github: <GitHubIcon />,
  slack: <SlackIcon />,
};
const LABELS: Record<string, string> = { google: "Google", microsoft: "Microsoft", apple: "Apple", github: "GitHub", slack: "Slack" };

export function VerifyEmailButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={state === "sending"}
        onClick={async () => {
          setState("sending");
          const res = await authClient.sendVerificationEmail({ email, callbackURL: "/app" });
          setState(res.error ? "error" : "sent");
        }}
      >
        {state === "sending" ? "Sending…" : "Send verification email"}
      </Button>
      {state === "sent" && <span className="text-[13px] text-ok">Sent. Check your inbox (or the server log if email isn&apos;t set up).</span>}
      {state === "error" && <span className="text-[13px] text-danger">Couldn&apos;t send. Try again shortly.</span>}
    </span>
  );
}

export function ConnectProviders({ enabled, connected }: { enabled: string[]; connected: string[] }) {
  const [error, setError] = useState<string | null>(null);
  if (!enabled.length) return <p className="text-sm text-text-3">No sign-in providers are configured on this server yet.</p>;
  return (
    <div className="space-y-2">
      {enabled.map((id) => {
        const isConnected = connected.includes(id);
        return (
          <div key={id} className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-2.5">
            {ICONS[id]}
            <span className="flex-1 text-sm font-medium">{LABELS[id]}</span>
            {isConnected ? (
              <span className="text-[13px] text-ok">Connected</span>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  setError(null);
                  const res = await authClient.linkSocial({ provider: id as "google", callbackURL: "/app/account" });
                  if (res?.error) setError(res.error.message ?? "Couldn't connect.");
                }}
              >
                Connect
              </Button>
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function PasskeyPanel({ passkeys }: { passkeys: { id: string; name: string | null; createdAt: string | null; deviceType: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {passkeys.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <Fingerprint size={17} className="text-text-3" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{p.name || "Passkey"}</span>
                <span className="block text-xs text-text-3">
                  {p.deviceType === "multiDevice" ? "Synced across devices" : "This device only"}
                  {p.createdAt && ` · added ${new Date(p.createdAt).toLocaleDateString()}`}
                </span>
              </span>
              <button
                className="rounded-md p-1.5 text-text-3 hover:bg-card-muted hover:text-danger"
                aria-label={`Remove ${p.name || "passkey"}`}
                onClick={async () => {
                  const res = await authClient.passkey.deletePasskey({ id: p.id });
                  if (res.error) setError(res.error.message ?? "Couldn't remove it.");
                  else router.refresh();
                }}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-2">No passkeys yet. Add one to sign in with Face ID, Touch ID, Windows Hello or a security key — no password needed.</p>
      )}
      <Button
        variant="secondary"
        disabled={busy}
        className={cn(busy && "opacity-70")}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const ua = navigator.userAgent;
          const name = /Mac/.test(ua) ? "Mac" : /iPhone|iPad/.test(ua) ? "iPhone / iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : "This device";
          const res = await authClient.passkey.addPasskey({ name });
          setBusy(false);
          if (res?.error) setError(res.error.message ?? "Couldn't add a passkey.");
          else router.refresh();
        }}
      >
        <Fingerprint size={16} /> {busy ? "Waiting for your device…" : "Add a passkey"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
