import "server-only";
import { StorageError, type HttpStorageConfig, type StoredFileInfo, type TwinStorage } from "./types";

/**
 * Customer-hosted storage API. Contract (documented at /docs/storage-api):
 *   GET    {base}/files?prefix=<p>  -> 200 { "files": [{ "path", "updatedAt"?, "size"? }] }
 *   GET    {base}/files/<path>      -> 200 text/markdown, or 404
 *   PUT    {base}/files/<path>      -> 2xx (body: text/markdown)
 *   DELETE {base}/files/<path>      -> 2xx or 404
 * Every request carries "Authorization: Bearer <token>".
 */
export function httpStorage(config: HttpStorageConfig): TwinStorage {
  const base = config.baseUrl.replace(/\/+$/, "");
  const fileUrl = (path: string) => `${base}/files/${path.split("/").map(encodeURIComponent).join("/")}`;
  const headers = { Authorization: `Bearer ${config.token}`, "User-Agent": "DigitalTwin-Storage/1" };

  async function call(url: string, init: RequestInit, op: string) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers: { ...headers, ...init.headers }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    } catch (err) {
      throw new StorageError(`Storage API ${op} could not connect: ${(err as Error).message}`);
    }
    return res;
  }

  async function fail(res: Response, op: string): Promise<never> {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new StorageError(`Storage API ${op} returned ${res.status}${body ? `: ${body}` : ""}`);
  }

  return {
    kind: "http",
    async read(path) {
      const res = await call(fileUrl(path), { method: "GET" }, "read");
      if (res.status === 404) return null;
      if (!res.ok) await fail(res, "read");
      return res.text();
    },
    async write(path, content) {
      const res = await call(
        fileUrl(path),
        { method: "PUT", body: content, headers: { "Content-Type": "text/markdown; charset=utf-8" } },
        "write",
      );
      if (!res.ok) await fail(res, "write");
    },
    async list(prefix) {
      const res = await call(`${base}/files?prefix=${encodeURIComponent(prefix)}`, { method: "GET" }, "list");
      if (!res.ok) await fail(res, "list");
      const json = (await res.json().catch(() => null)) as { files?: StoredFileInfo[] } | null;
      if (!json || !Array.isArray(json.files)) throw new StorageError('Storage API list must return { "files": [...] }');
      return json.files.filter((f) => typeof f?.path === "string");
    },
    async delete(path) {
      const res = await call(fileUrl(path), { method: "DELETE" }, "delete");
      if (!res.ok && res.status !== 404) await fail(res, "delete");
    },
  };
}
