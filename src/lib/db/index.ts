import "server-only";
import path from "node:path";
import { mkdirSync } from "node:fs";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

type Cache = { db?: Promise<DB> };
const cache = globalThis as unknown as { __digitalTwinDb?: Cache };
cache.__digitalTwinDb ??= {};

const MIGRATIONS = path.join(process.cwd(), "drizzle");

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const db = drizzle(new Pool({ connectionString: url, max: 10 }), { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db;
  }

  // Local development: embedded Postgres (PGlite), stored in .data/pglite.
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

/** Returns the database, connecting and applying migrations on first use. */
export function getDb(): Promise<DB> {
  cache.__digitalTwinDb!.db ??= connect().catch((err) => {
    cache.__digitalTwinDb!.db = undefined;
    throw err;
  });
  return cache.__digitalTwinDb!.db;
}

export { schema };
