import "server-only";
import os from "node:os";
import path from "node:path";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { StorageError, type LocalStorageConfig, type StoredFileInfo, type TwinStorage } from "./types";

/** Expands "~/..." to the home folder of the user running Digital Twin. */
export function resolveLocalDir(dir: string) {
  const expanded = dir.startsWith("~") ? path.join(os.homedir(), dir.slice(1)) : dir;
  return path.resolve(expanded);
}

/**
 * A folder on the machine that runs Digital Twin. Only offered when local
 * endpoints are allowed (self-hosting), because it writes to the server's disk.
 */
export function localFolderStorage(config: LocalStorageConfig): TwinStorage {
  const root = resolveLocalDir(config.dir);

  const fileFor = (rel: string) => {
    const target = path.resolve(root, rel);
    const inside = path.relative(root, target);
    if (!rel || inside.startsWith("..") || path.isAbsolute(inside)) throw new StorageError(`Refusing path outside the storage folder: ${rel}`);
    return target;
  };

  const wrap = async <T>(op: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(`Local folder ${op} failed (${root}): ${(err as Error).message}`);
    }
  };

  async function walk(dir: string, out: StoredFileInfo[]) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full, out);
      else if (e.isFile()) {
        const s = await stat(full);
        out.push({ path: path.relative(root, full).split(path.sep).join("/"), updatedAt: s.mtime.toISOString(), size: s.size });
      }
    }
  }

  return {
    kind: "local",
    read: (rel) =>
      wrap("read", async () => {
        try {
          return await readFile(fileFor(rel), "utf8");
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw err;
        }
      }),
    write: (rel, content) =>
      wrap("write", async () => {
        const file = fileFor(rel);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, content, "utf8");
      }),
    list: (prefix) =>
      wrap("list", async () => {
        const out: StoredFileInfo[] = [];
        await walk(root, out);
        return out.filter((f) => f.path.startsWith(prefix));
      }),
    delete: (rel) =>
      wrap("delete", async () => {
        await rm(fileFor(rel), { force: true });
      }),
  };
}
