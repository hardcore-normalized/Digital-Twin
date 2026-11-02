import "server-only";
import type { DB } from "./db";
import { schema } from "./db";

export async function recordAudit(
  db: DB,
  entry: { zoneId: string; personId?: string | null; actor: string; action: string; detail: string },
) {
  await db.insert(schema.auditEvents).values({ ...entry, personId: entry.personId ?? null });
}

export const actorFor = (email: string) => `user:${email}`;
