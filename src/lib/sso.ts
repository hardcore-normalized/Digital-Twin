import "server-only";
import { createHmac } from "node:crypto";
import { resolveTxt } from "node:dns/promises";

/** One SSO provider per zone; the id also appears in the IdP redirect URL. */
export const ssoProviderIdFor = (zoneId: string) => `dt-${zoneId.replace(/-/g, "").slice(0, 12)}`;

/** The DNS TXT record a company adds to prove it owns its email domain. */
export function ssoDnsRecord(providerId: string, domain: string) {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const token = createHmac("sha256", secret).update(`${providerId}:${domain}`).digest("hex").slice(0, 32);
  return { name: `_digital-twin-verify.${domain}`, value: `digital-twin-verification=${token}` };
}

export async function checkSsoDomain(providerId: string, domain: string) {
  const rec = ssoDnsRecord(providerId, domain);
  const records = (await resolveTxt(rec.name)).map((parts) => parts.join(""));
  return records.includes(rec.value);
}

export function ssoCallbackUrl(providerId: string) {
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/api/auth/sso/callback/${providerId}`;
}
