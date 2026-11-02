"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Building2, Fingerprint } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AppleIcon, GitHubIcon, GoogleIcon, MicrosoftIcon, SlackIcon } from "./brand-icons";
import { Button, Card, Field, Input, cn } from "./ui";

type ProviderId = "google" | "microsoft" | "apple" | "github" | "slack";

const PROVIDERS: { id: ProviderId; label: string; icon: ReactNode }[] = [
  { id: "google", label: "Google", icon: <GoogleIcon /> },
  { id: "microsoft", label: "Microsoft", icon: <MicrosoftIcon /> },
  { id: "apple", label: "Apple", icon: <AppleIcon /> },
  { id: "github", label: "GitHub", icon: <GitHubIcon /> },
  { id: "slack", label: "Slack", icon: <SlackIcon /> },
];

const ERRORS: Record<string, string> = {
  sso: "Single sign-on didn't complete. Check with your company's admin that SSO is set up and its domain is verified.",
  social: "That sign-in didn't complete. Try again, or use another method.",
};

function LastUsed() {
  return <span className="ml-auto rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">Last used</span>;
}

export function AuthForm({
  mode,
  social,
  next,
  initialError,
}: {
  mode: "sign-in" | "sign-up";
  social: Record<ProviderId, boolean>;
  next: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError ? ERRORS[initialError] ?? null : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ssoOpen, setSsoOpen] = useState(false);
  const [lastUsed, setLastUsed] = useState<string | null>(null);

  // Read after mount: the hint lives in a cookie, so it can't be rendered on the server.
  useEffect(() => setLastUsed(authClient.getLastUsedLoginMethod()), []);

  const enabled = PROVIDERS.filter((p) => social[p.id]);
  const errorCallbackURL = `/sign-in?error=`;

  async function withBusy(key: string, fn: () => Promise<{ error?: { message?: string } | null } | void>) {
    setError(null);
    setBusy(key);
    try {
      const res = await fn();
      if (res && res.error) setError(res.error.message ?? "Something went wrong.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function submitPassword(fd: FormData) {
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    await withBusy("email", async () => {
      const res =
        mode === "sign-up"
          ? await authClient.signUp.email({ email, password, name: String(fd.get("name") ?? "").trim() || email.split("@")[0], callbackURL: next })
          : await authClient.signIn.email({ email, password });
      if (!res.error) {
        router.push(next);
        router.refresh();
      }
      return res;
    });
  }

  async function submitSso(fd: FormData) {
    const email = String(fd.get("ssoEmail") ?? "").trim();
    await withBusy("sso", async () => {
      const res = await authClient.signIn.sso({ email, callbackURL: next, errorCallbackURL: `${errorCallbackURL}sso` });
      if (res.error) {
        const msg = res.error.message ?? "";
        if (msg.includes("not been verified"))
          return { error: { message: "Your company's SSO isn't switched on yet: an admin still needs to verify the domain in Settings → Access." } };
        if (msg.includes("not found") || res.error.status === 404) return { error: { message: "No company SSO is set up for that email domain yet." } };
        return res;
      }
      return res;
    });
  }

  return (
    <Card className="p-6">
      <h1 className="font-serif text-2xl font-medium">{mode === "sign-up" ? "Create your account" : "Sign in"}</h1>
      <p className="mt-1 text-sm text-text-2">
        {mode === "sign-up" ? "Use your work email so we can match you to your seat. It's free." : "Welcome back."}
      </p>

      <div className="mt-5 space-y-2">
        {enabled.map((p) => (
          <Button
            key={p.id}
            variant="secondary"
            className="w-full justify-start gap-3 px-4"
            disabled={busy !== null}
            onClick={() =>
              withBusy(p.id, () => authClient.signIn.social({ provider: p.id, callbackURL: next, errorCallbackURL: `${errorCallbackURL}social` }))
            }
          >
            {p.icon}
            Continue with {p.label}
            {lastUsed === p.id && <LastUsed />}
          </Button>
        ))}

        {mode === "sign-in" && (
          <Button
            variant="secondary"
            className="w-full justify-start gap-3 px-4"
            disabled={busy !== null}
            onClick={() =>
              withBusy("passkey", async () => {
                const res = await authClient.signIn.passkey();
                if (res && !res.error) {
                  router.push(next);
                  router.refresh();
                }
                return res ?? undefined;
              })
            }
          >
            <Fingerprint size={17} />
            {busy === "passkey" ? "Waiting for your passkey…" : "Continue with a passkey"}
            {lastUsed === "passkey" && <LastUsed />}
          </Button>
        )}

        <Button
          variant="secondary"
          className={cn("w-full justify-start gap-3 px-4", ssoOpen && "border-accent")}
          disabled={busy !== null}
          onClick={() => setSsoOpen((o) => !o)}
          aria-expanded={ssoOpen}
        >
          <Building2 size={17} />
          Continue with company SSO
          {lastUsed === "sso" && <LastUsed />}
        </Button>
        {ssoOpen && (
          <form action={submitSso} className="space-y-2 rounded-lg border border-border bg-card-muted p-3">
            <Field label="Work email" hint="Okta, Microsoft Entra, Google Workspace…">
              <Input name="ssoEmail" type="email" autoComplete="email" placeholder="you@company.com" required autoFocus />
            </Field>
            <Button type="submit" className="w-full" disabled={busy !== null}>
              {busy === "sso" ? "Finding your company…" : "Continue"}
            </Button>
          </form>
        )}
      </div>

      <div className="flex items-center gap-3 py-4 text-xs text-text-3">
        <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
      </div>

      <form action={submitPassword} className="space-y-4">
        {mode === "sign-up" && (
          <Field label="Full name">
            <Input name="name" autoComplete="name" required />
          </Field>
        )}
        <Field label="Work email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" hint={mode === "sign-up" ? "8+ characters" : undefined}>
          <Input name="password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} required />
        </Field>
        <Button type="submit" className="w-full" disabled={busy !== null}>
          {busy === "email" ? "Please wait…" : mode === "sign-up" ? "Create account" : "Sign in"}
          {mode === "sign-in" && lastUsed === "email" && <span className="ml-2 rounded bg-white/20 px-1.5 text-[11px]">Last used</span>}
        </Button>
      </form>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <p className="mt-5 text-center text-sm text-text-2">
        {mode === "sign-up" ? (
          <>
            Already have an account? <Link href="/sign-in" className="text-accent hover:underline">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/sign-up" className="text-accent hover:underline">Create an account</Link>
          </>
        )}
      </p>
    </Card>
  );
}
