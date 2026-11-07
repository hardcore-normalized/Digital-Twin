import "server-only";
import { createHash } from "node:crypto";
import type { DB } from "./db";
import * as schema from "./db/schema";
import { DEMO_SLUG, DEMO_ZONE_ID } from "./site-mode";

/**
 * The website's live demo: the fictional Acme company, built in memory when a
 * server starts. Visitors browse it as Rahul, the zone owner.
 */
export const DEMO_VISITOR = {
  id: "demo-visitor",
  name: "Rahul Mehta",
  email: "rahul.mehta@acme.example",
  emailVerified: true,
};

/**
 * A UUID derived from text. The website runs on several servers, each with its
 * own copy of the demo, so people need the same IDs (and page URLs) on all of them.
 */
export function stableUuid(text: string) {
  const h = createHash("sha256").update(text).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function seedLiveDemo(db: DB) {
  const started = Date.now();
  await db.insert(schema.user).values(DEMO_VISITOR);
  await db.insert(schema.zones).values({ id: DEMO_ZONE_ID, name: "Acme", slug: DEMO_SLUG, syncTimezone: "UTC" });
  await db.insert(schema.memberships).values({ zoneId: DEMO_ZONE_ID, userId: DEMO_VISITOR.id, role: "owner" });
  await db.insert(schema.storageConfigs).values({ zoneId: DEMO_ZONE_ID, kind: "builtin" });
  await db.insert(schema.connections).values({ zoneId: DEMO_ZONE_ID, provider: "demo", label: "Demo data (Acme)" });
  const { runSync } = await import("./sync");
  await runSync(DEMO_ZONE_ID, "demo", db);
  console.log(`[demo] built the Acme demo in ${Date.now() - started} ms`);
}
