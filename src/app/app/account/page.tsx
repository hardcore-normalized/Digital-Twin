import Link from "next/link";
import { eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { ConnectProviders, PasskeyPanel, VerifyEmailButton } from "@/components/account-panels";
import { Badge, Card, CardHeader } from "@/components/ui";
import { listUserZones, requireUser } from "@/lib/access";
import { enabledSocialProviders } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

export const metadata = { title: "Your account" };

export default async function Account() {
  const user = await requireUser();
  const db = await getDb();
  const [passkeys, accounts, zones] = await Promise.all([
    db.select().from(schema.passkey).where(eq(schema.passkey.userId, user.id)),
    db.select({ providerId: schema.account.providerId }).from(schema.account).where(eq(schema.account.userId, user.id)),
    listUserZones(user.id),
  ]);
  const connected = accounts.map((a) => a.providerId);
  const enabled = Object.entries(enabledSocialProviders).filter(([, on]) => on).map(([id]) => id);
  const back = zones[0] ? (zones[0].role === "member" ? `/app/${zones[0].slug}/me` : `/app/${zones[0].slug}`) : "/app";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <Logo href="/app" />
        <Link href={back} className="inline-flex items-center gap-1 text-sm text-text-2 hover:text-text">
          <ChevronLeft size={15} /> Back to dashboard
        </Link>
      </div>
      <h1 className="font-serif text-[28px] font-medium">Your account</h1>
      <p className="mt-1 text-sm text-text-2">{user.name} · {user.email}</p>

      <div className="mt-8 space-y-5">
        <Card>
          <CardHeader title="Email" action={<Badge tone={user.emailVerified ? "ok" : "warn"}>{user.emailVerified ? "Verified" : "Not verified"}</Badge>} />
          <div className="space-y-3 px-5 py-5 text-sm text-text-2">
            {user.emailVerified ? (
              <p>Your email is verified, so invites and your own twin are linked to your account automatically.</p>
            ) : (
              <>
                <p>
                  Verify your email to join your company&apos;s zone and see your own twin. Signing in with Google, Microsoft, Apple, GitHub,
                  Slack or company SSO verifies it automatically.
                </p>
                <VerifyEmailButton email={user.email} />
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Sign-in methods" description="Connect accounts so you can sign in with any of them." />
          <div className="space-y-3 px-5 py-5">
            <div className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-2.5">
              <span className="flex-1 text-sm font-medium">Email and password</span>
              <span className={connected.includes("credential") ? "text-[13px] text-ok" : "text-[13px] text-text-3"}>
                {connected.includes("credential") ? "Set" : "Not set"}
              </span>
            </div>
            {connected.some((p) => p.startsWith("dt-")) && (
              <div className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-2.5">
                <span className="flex-1 text-sm font-medium">Company SSO</span>
                <span className="text-[13px] text-ok">Connected</span>
              </div>
            )}
            <ConnectProviders enabled={enabled} connected={connected} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Passkeys" description="Sign in with your fingerprint, face or device PIN." />
          <div className="px-5 py-5">
            <PasskeyPanel
              passkeys={passkeys.map((p) => ({ id: p.id, name: p.name, deviceType: p.deviceType, createdAt: p.createdAt?.toISOString() ?? null }))}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
