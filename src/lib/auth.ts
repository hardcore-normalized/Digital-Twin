import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { lastLoginMethod } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { sso } from "@better-auth/sso";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema, type DB } from "./db";
import { sendEmail } from "./email";

const env = (name: string) => process.env[name] || undefined;
const pair = (id: string, secret: string) => (env(id) && env(secret) ? { clientId: env(id)!, clientSecret: env(secret)! } : undefined);

/** "Continue with …" providers, each switched on by its OAuth credentials in the environment. */
function socialProviders() {
  const microsoft = pair("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET");
  const apple = pair("APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET");
  return {
    google: pair("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
    microsoft: microsoft && { ...microsoft, tenantId: env("MICROSOFT_TENANT_ID") ?? "common" },
    apple: apple && { ...apple, appBundleIdentifier: env("APPLE_APP_BUNDLE_IDENTIFIER") },
    github: pair("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"),
    slack: pair("SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"),
  };
}

export type SocialProviderId = "google" | "microsoft" | "apple" | "github" | "slack";

export const enabledSocialProviders = Object.fromEntries(
  Object.entries(socialProviders()).map(([k, v]) => [k, Boolean(v)]),
) as Record<SocialProviderId, boolean>;

/**
 * Identity providers whose OIDC discovery the app may fetch when a company sets
 * up SSO. Microsoft Entra and Google are trusted by default; add others (an
 * Okta, Auth0 or Keycloak tenant) with SSO_TRUSTED_ISSUERS.
 */
export function ssoTrustedIssuers() {
  const extra = (env("SSO_TRUSTED_ISSUERS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ["https://login.microsoftonline.com", "https://accounts.google.com", ...extra];
}

/** Issuers plus the official endpoint hosts their discovery documents point to (token, keys, userinfo). */
function ssoEndpointOrigins() {
  return [
    ...ssoTrustedIssuers(),
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
    "https://openidconnect.googleapis.com",
    "https://graph.microsoft.com",
  ];
}

function createAuth(db: DB) {
  const baseUrl = new URL(env("BETTER_AUTH_URL") ?? "http://localhost:3000");
  const production = process.env.NODE_ENV === "production";
  const social = Object.fromEntries(Object.entries(socialProviders()).filter(([, v]) => v));

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        ssoProvider: schema.ssoProvider,
        passkey: schema.passkey,
      },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    // Email ownership matters: zone access from invites and tracked people is
    // only granted to verified addresses (see claimAccess).
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Verify your email for Digital Twin",
          text: `Hi ${user.name || "there"},\n\nConfirm this is your email address to join your company's zone:\n\n${url}\n\nIf you didn't sign up for Digital Twin, you can ignore this email.`,
        });
      },
    },
    trustedOrigins: [
      // In development, accept any localhost port (e.g. when 3000 is taken and Next picks 3001).
      ...(production ? [] : ["http://localhost:*", "http://127.0.0.1:*"]),
      ...(social.apple ? ["https://appleid.apple.com"] : []),
      ...ssoEndpointOrigins(),
    ],
    socialProviders: social,
    plugins: [
      sso({
        // A company must prove it owns its email domain (DNS TXT) before its SSO works.
        domainVerification: { enabled: true },
        // Only zone owners and admins can set up SSO, one provider at a time.
        providersLimit: async (u) => {
          const rows = await db
            .select({ role: schema.memberships.role })
            .from(schema.memberships)
            .where(and(eq(schema.memberships.userId, u.id), inArray(schema.memberships.role, ["owner", "admin"])));
          return rows.length ? 5 : 0;
        },
        // People who sign in through a domain-verified provider own that email.
        provisionUserOnEveryLogin: true,
        provisionUser: async ({ user, provider }) => {
          if (user.emailVerified) return;
          const [row] = await db
            .select({ domain: schema.ssoProvider.domain, verified: schema.ssoProvider.domainVerified })
            .from(schema.ssoProvider)
            .where(eq(schema.ssoProvider.providerId, provider.providerId));
          const domain = user.email.split("@")[1]?.toLowerCase();
          const domains = (row?.domain ?? "").split(",").map((d) => d.trim().toLowerCase());
          if (row?.verified && domain && domains.includes(domain))
            await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, user.id));
        },
      }),
      passkey({
        rpID: baseUrl.hostname,
        rpName: "Digital Twin",
        // In development the browser supplies its own origin, so any localhost port works.
        origin: production ? baseUrl.origin : undefined,
      }),
      lastLoginMethod(),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Module-level (not global) so edits to this file take effect on hot reload.
let authPromise: Promise<Auth> | undefined;

export function getAuth(): Promise<Auth> {
  authPromise ??= getDb().then(createAuth);
  return authPromise;
}
