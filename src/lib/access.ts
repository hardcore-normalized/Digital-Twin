import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getAuth } from "./auth";
import { getDb, schema } from "./db";
import type { ZoneRole } from "./db/schema";

export type CurrentUser = { id: string; name: string; email: string; emailVerified: boolean };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email.toLowerCase(), emailVerified: Boolean(session.user.emailVerified) };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/**
 * Turns pending invites into memberships, and gives people who are tracked in a
 * zone "member" access so they can see their own twin. Only for verified email
 * addresses: otherwise anyone could sign up with someone else's address first.
 */
export async function claimAccess(user: CurrentUser) {
  if (!user.emailVerified) return;
  const db = await getDb();
  const invites = await db
    .select()
    .from(schema.zoneInvites)
    .where(eq(schema.zoneInvites.email, user.email));
  const tracked = await db
    .select({ zoneId: schema.people.zoneId })
    .from(schema.people)
    .where(and(eq(schema.people.email, user.email), eq(schema.people.status, "active")));

  const wanted = new Map<string, ZoneRole>();
  for (const t of tracked) wanted.set(t.zoneId, "member");
  for (const i of invites) wanted.set(i.zoneId, i.role);
  if (wanted.size === 0) return;

  const existing = await db
    .select({ zoneId: schema.memberships.zoneId })
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.userId, user.id),
        inArray(schema.memberships.zoneId, [...wanted.keys()]),
      ),
    );
  const have = new Set(existing.map((e) => e.zoneId));
  const rows = [...wanted]
    .filter(([zoneId]) => !have.has(zoneId))
    .map(([zoneId, role]) => ({ zoneId, userId: user.id, role }));
  if (rows.length) await db.insert(schema.memberships).values(rows).onConflictDoNothing();
  if (invites.length)
    await db.delete(schema.zoneInvites).where(eq(schema.zoneInvites.email, user.email));
}

export async function listUserZones(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: schema.zones.id,
      name: schema.zones.name,
      slug: schema.zones.slug,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .innerJoin(schema.zones, eq(schema.zones.id, schema.memberships.zoneId))
    .where(eq(schema.memberships.userId, userId))
    .orderBy(schema.zones.name);
}

export type ZoneContext = Awaited<ReturnType<typeof loadZone>>;

async function loadZone(slug: string, user: CurrentUser) {
  const db = await getDb();
  const [row] = await db
    .select({ zone: schema.zones, role: schema.memberships.role })
    .from(schema.zones)
    .innerJoin(
      schema.memberships,
      and(eq(schema.memberships.zoneId, schema.zones.id), eq(schema.memberships.userId, user.id)),
    )
    .where(eq(schema.zones.slug, slug));
  if (!row) return null;
  const [self] = await db
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.zoneId, row.zone.id), eq(schema.people.email, user.email)));
  return {
    zone: row.zone,
    role: row.role,
    user,
    /** The tracked person record for the signed-in user, if they are tracked in this zone. */
    self: self ?? null,
    canManage: row.role === "owner" || row.role === "admin",
  };
}

/** Loads a zone the current user can access, or redirects. */
export const requireZone = cache(async (slug: string) => {
  const user = await requireUser();
  const ctx = await loadZone(slug, user);
  if (!ctx) redirect("/app");
  return ctx;
});

export async function requireManager(slug: string) {
  const ctx = await requireZone(slug);
  if (!ctx.canManage) redirect(`/app/${slug}/me`);
  return ctx;
}

/** For API routes: same checks, but returns null instead of redirecting. */
export async function zoneForApi(zoneId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await getDb();
  const [zone] = await db.select().from(schema.zones).where(eq(schema.zones.id, zoneId));
  if (!zone) return null;
  return loadZone(zone.slug, user);
}

/** Managers can see everyone; members only themselves. */
export function canViewPerson(ctx: NonNullable<ZoneContext>, personId: string) {
  return ctx.canManage || ctx.self?.id === personId;
}
