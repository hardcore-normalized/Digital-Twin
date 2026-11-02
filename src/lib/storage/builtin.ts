import "server-only";
import { and, eq, like } from "drizzle-orm";
import type { DB } from "../db";
import { schema } from "../db";
import type { TwinStorage } from "./types";

/** Default backend: files are stored as rows in our own database. */
export function builtinStorage(db: DB, zoneId: string): TwinStorage {
  const t = schema.storedFiles;
  return {
    kind: "builtin",
    async read(path) {
      const [row] = await db
        .select({ content: t.content })
        .from(t)
        .where(and(eq(t.zoneId, zoneId), eq(t.path, path)));
      return row?.content ?? null;
    },
    async write(path, content) {
      await db
        .insert(t)
        .values({ zoneId, path, content, updatedAt: new Date() })
        .onConflictDoUpdate({ target: [t.zoneId, t.path], set: { content, updatedAt: new Date() } });
    },
    async list(prefix) {
      const escaped = prefix.replace(/[\\%_]/g, (c) => `\\${c}`);
      const rows = await db
        .select({ path: t.path, updatedAt: t.updatedAt, content: t.content })
        .from(t)
        .where(and(eq(t.zoneId, zoneId), like(t.path, `${escaped}%`)));
      return rows.map((r) => ({
        path: r.path,
        updatedAt: r.updatedAt.toISOString(),
        size: r.content.length,
      }));
    },
    async delete(path) {
      await db.delete(t).where(and(eq(t.zoneId, zoneId), eq(t.path, path)));
    },
  };
}
