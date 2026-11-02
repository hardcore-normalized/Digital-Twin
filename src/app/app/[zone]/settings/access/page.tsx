import { eq } from "drizzle-orm";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, CardHeader, Field, Input, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { requireManager } from "@/lib/access";
import { inviteMember, removeAccess, removeZoneSso, saveZoneSso, verifyZoneSso } from "@/lib/actions";
import { ssoTrustedIssuers } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { ssoCallbackUrl, ssoDnsRecord, ssoProviderIdFor } from "@/lib/sso";
import { getMembers } from "@/lib/queries";

export const metadata = { title: "Access" };

export default async function AccessSettings({ params }: { params: Promise<{ zone: string }> }) {
  const { zone: slug } = await params;
  const ctx = await requireManager(slug);
  const { members, invites } = await getMembers(ctx.zone.id);
  const providerId = ssoProviderIdFor(ctx.zone.id);
  const db = await getDb();
  const [sso] = await db.select().from(schema.ssoProvider).where(eq(schema.ssoProvider.providerId, providerId));
  const ssoClientId = sso?.oidcConfig ? ((JSON.parse(sso.oidcConfig) as { clientId?: string }).clientId ?? "") : "";
  const dns = sso ? ssoDnsRecord(providerId, sso.domain) : null;
  return (
    <>
      <PageHeader title="Access" description="Who can sign in to this zone. People tracked in the zone automatically get member access to their own twin when they sign up with their work email." />
      <div className="max-w-3xl space-y-5">
        <Card className="overflow-hidden">
          <CardHeader title="Members" />
          <Table>
            <thead>
              <tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th /></tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId}>
                  <Td className="font-medium">{m.name}</Td>
                  <Td className="text-text-2">{m.email}</Td>
                  <Td><Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Badge></Td>
                  <Td align="right">
                    {m.role !== "owner" && m.userId !== ctx.user.id && (
                      <form action={removeAccess.bind(null, slug, m.userId, null)}>
                        <button className="text-[13px] text-text-3 hover:text-danger">Remove</button>
                      </form>
                    )}
                  </Td>
                </tr>
              ))}
              {invites.map((i) => (
                <tr key={i.id}>
                  <Td className="text-text-3">Pending</Td>
                  <Td className="text-text-2">{i.email}</Td>
                  <Td><Badge>{i.role}</Badge></Td>
                  <Td align="right">
                    <form action={removeAccess.bind(null, slug, null, i.id)}>
                      <button className="text-[13px] text-text-3 hover:text-danger">Cancel</button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader
            title="Company single sign-on (SSO)"
            description="Let people at your company sign in with Okta, Microsoft Entra, Google Workspace or another OIDC provider."
            action={<Badge tone={sso?.domainVerified ? "ok" : sso ? "warn" : "neutral"}>{sso?.domainVerified ? "On" : sso ? "Waiting for DNS" : "Off"}</Badge>}
          />
          <div className="space-y-5 px-5 py-5">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-text-2">
              <li>
                In your identity provider, create an OIDC web app with this redirect URL:{" "}
                <code className="rounded bg-card-muted px-1.5 py-0.5 font-mono text-xs break-all">{ssoCallbackUrl(providerId)}</code>
              </li>
              <li>Paste its issuer URL, client ID and client secret below, with your company&apos;s email domain.</li>
              <li>Add the DNS TXT record we show you, so we know the domain is yours. SSO turns on once it&apos;s found.</li>
            </ol>
            <ActionForm action={saveZoneSso.bind(null, slug)} submitLabel={sso ? "Save changes" : "Set up SSO"} pendingLabel="Checking your provider…">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Issuer URL">
                  <Input name="issuer" defaultValue={sso?.issuer ?? ""} placeholder="https://login.microsoftonline.com/<tenant>/v2.0" required />
                </Field>
                <Field label="Email domain">
                  <Input name="domain" defaultValue={sso?.domain ?? ""} placeholder="acme.com" required />
                </Field>
                <Field label="Client ID">
                  <Input name="clientId" defaultValue={ssoClientId} autoComplete="off" required />
                </Field>
                <Field label="Client secret" hint={sso ? "leave blank to keep the saved one" : undefined}>
                  <Input name="clientSecret" type="password" autoComplete="off" placeholder={sso ? "••••••••" : ""} />
                </Field>
              </div>
            </ActionForm>
            <p className="text-xs text-text-3">
              Trusted identity providers on this server: {ssoTrustedIssuers().map((o) => o.replace("https://", "")).join(", ")}. Others (an Okta or Auth0
              tenant, Keycloak…) can be added by whoever runs Digital Twin with SSO_TRUSTED_ISSUERS.
            </p>
            {sso && dns && !sso.domainVerified && (
              <div className="space-y-3 rounded-lg border border-border bg-card-muted p-4">
                <div className="text-sm font-medium">Verify that you own {sso.domain}</div>
                <p className="text-[13px] text-text-2">Add this TXT record at your DNS provider, then check:</p>
                <dl className="grid gap-2 text-[13px] sm:grid-cols-[80px_1fr]">
                  <dt className="text-text-3">Name</dt>
                  <dd><code className="font-mono break-all">{dns.name}</code></dd>
                  <dt className="text-text-3">Value</dt>
                  <dd><code className="font-mono break-all">{dns.value}</code></dd>
                </dl>
                <ActionButton action={verifyZoneSso.bind(null, slug)} label="Check DNS" pendingLabel="Looking up DNS…" size="sm" />
              </div>
            )}
            {sso && (
              <form action={removeZoneSso.bind(null, slug)}>
                <button className="text-[13px] text-text-3 hover:text-danger">Turn off SSO and remove these settings</button>
              </form>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Give access" description="Admins see everyone. Members see only their own twin." />
          <div className="px-5 py-5">
            <ActionForm action={inviteMember.bind(null, slug)} submitLabel="Give access">
              <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <Field label="Email"><Input name="email" type="email" required /></Field>
                <Field label="Role">
                  <Select name="role" defaultValue="admin">
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </Select>
                </Field>
              </div>
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}
