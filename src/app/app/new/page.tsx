import { Logo } from "@/components/logo";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input } from "@/components/ui";
import { createZone } from "@/lib/actions";
import { requireUser } from "@/lib/access";
import { VerifyEmailButton } from "@/components/account-panels";
import { TimezoneInput } from "@/components/timezone-input";

export const metadata = { title: "Create a zone" };

export default async function NewZone({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const user = await requireUser();
  const { demo } = await searchParams;
  const options = [
    { value: "demo", title: "Explore with demo data", body: "A fictional 14-person company with 45 days of usage, check-ins and twins. You can connect real data later." },
    { value: "claude", title: "Connect Claude Enterprise", body: "Paste an Analytics API key from claude.ai and import your organization's last 30 days." },
  ];
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <Logo href="/app" />
      <Card className="mt-10 w-full max-w-lg p-7">
        <h1 className="font-serif text-2xl font-medium">Create your zone</h1>
        <p className="mt-1 text-sm text-text-2">A zone is your company&apos;s shared space: its people, their usage and their twins.</p>
        {!user.emailVerified && (
          <div className="mt-3 space-y-2 rounded-lg border border-border px-3 py-3 text-[13px] text-text-2">
            <p>
              <span className="font-medium text-text">Joining your company instead?</span> Verify your email ({user.email}) and you&apos;ll be added to
              any zone that invited you or tracks you.
            </p>
            <VerifyEmailButton email={user.email} />
          </div>
        )}
        <p className="mt-3 rounded-lg bg-card-muted px-3 py-2 text-[13px] text-text-2">
          Digital Twin is free. You&apos;ll connect your own keys: a Claude Enterprise Analytics key, and optionally an Anthropic API key for twin chat.
        </p>
        <ActionForm action={createZone} submitLabel="Create zone" pendingLabel="Setting up…" className="mt-6">
          <TimezoneInput />
          <Field label="Company name">
            <Input name="name" placeholder="Acme Inc." required autoFocus />
          </Field>
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-[13px] font-medium">How do you want to start?</legend>
            {options.map((o) => (
              <label key={o.value} className="flex cursor-pointer gap-3 rounded-lg border border-border p-3.5 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/50">
                <input type="radio" name="start" value={o.value} defaultChecked={demo ? o.value === "demo" : o.value === "claude"} className="mt-1 accent-[var(--accent)]" />
                <span>
                  <span className="block text-sm font-medium">{o.title}</span>
                  <span className="mt-0.5 block text-[13px] text-text-2">{o.body}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </ActionForm>
      </Card>
    </div>
  );
}
