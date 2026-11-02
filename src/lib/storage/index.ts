import "server-only";
import { eq } from "drizzle-orm";
import type { DB } from "../db";
import { schema } from "../db";
import { decryptJson } from "../crypto";
import { builtinStorage } from "./builtin";
import { httpStorage } from "./http";
import { s3Storage } from "./s3";
import { localFolderStorage } from "./local";
import type { HttpStorageConfig, LocalStorageConfig, S3StorageConfig, TwinStorage } from "./types";

export * from "./types";

export async function getStorage(db: DB, zoneId: string): Promise<TwinStorage> {
  const [cfg] = await db.select().from(schema.storageConfigs).where(eq(schema.storageConfigs.zoneId, zoneId));
  if (!cfg || cfg.kind === "builtin" || !cfg.configEnc) return builtinStorage(db, zoneId);
  if (cfg.kind === "s3") return s3Storage(decryptJson<S3StorageConfig>(cfg.configEnc));
  if (cfg.kind === "local") return localFolderStorage(decryptJson<LocalStorageConfig>(cfg.configEnc));
  return httpStorage(decryptJson<HttpStorageConfig>(cfg.configEnc));
}

/** Round-trips a small file to prove the backend works. Throws on failure. */
export async function testStorage(storage: TwinStorage) {
  const path = `.digital-twin/healthcheck-${Date.now()}.md`;
  const body = `# Health check\n\nWritten by Digital Twin at ${new Date().toISOString()}\n`;
  await storage.write(path, body);
  const back = await storage.read(path);
  if (back !== body) throw new Error("Wrote a test file but could not read the same content back.");
  await storage.list(".digital-twin/");
  await storage.delete(path);
}
