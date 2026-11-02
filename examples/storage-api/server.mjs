// Reference implementation of the Digital Twin storage API.
// Stores twin files on local disk. No dependencies.
//
//   STORAGE_TOKEN=change-me PORT=4100 DATA_DIR=./storage-data node examples/storage-api/server.mjs
//
// Contract (see /docs/storage-api):
//   GET    /files?prefix=<p>  -> { files: [{ path, updatedAt, size }] }
//   GET    /files/<path>      -> 200 markdown | 404
//   PUT    /files/<path>      -> 204
//   DELETE /files/<path>      -> 204 | 404
import { createServer } from "node:http";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";

const TOKEN = process.env.STORAGE_TOKEN;
const PORT = Number(process.env.PORT ?? 4100);
const ROOT = path.resolve(process.env.DATA_DIR ?? "./storage-data");
const MAX_BYTES = 1024 * 1024;

if (!TOKEN || TOKEN.length < 8) {
  console.error("Set STORAGE_TOKEN (8+ characters).");
  process.exit(1);
}

const authorized = (req) => {
  const given = Buffer.from((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(TOKEN);
  return given.length === want.length && timingSafeEqual(given, want);
};

/** Maps an API path to a file under ROOT, refusing anything that escapes it. */
function resolveSafe(rel) {
  const target = path.resolve(ROOT, rel);
  const inside = path.relative(ROOT, target);
  if (!rel || inside.startsWith("..") || path.isAbsolute(inside)) return null;
  return target;
}

async function walk(dir, base = ROOT) {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, base)));
    else {
      const s = await stat(full);
      out.push({ path: path.relative(base, full).split(path.sep).join("/"), updatedAt: s.mtime.toISOString(), size: s.size });
    }
  }
  return out;
}

const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

createServer(async (req, res) => {
  try {
    if (!authorized(req)) return send(res, 401, { error: "unauthorized" });
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/files" && req.method === "GET") {
      const prefix = url.searchParams.get("prefix") ?? "";
      const files = (await walk(ROOT)).filter((f) => f.path.startsWith(prefix));
      return send(res, 200, { files });
    }

    if (!url.pathname.startsWith("/files/")) return send(res, 404, { error: "not found" });
    const rel = url.pathname.slice("/files/".length).split("/").map(decodeURIComponent).join("/");
    const file = resolveSafe(rel);
    if (!file) return send(res, 400, { error: "bad path" });

    if (req.method === "GET") {
      try {
        return send(res, 200, await readFile(file, "utf8"), "text/markdown; charset=utf-8");
      } catch {
        return send(res, 404, { error: "not found" });
      }
    }
    if (req.method === "PUT") {
      const chunks = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > MAX_BYTES) return send(res, 413, { error: "too large" });
        chunks.push(c);
      }
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.concat(chunks));
      res.writeHead(204).end();
      return;
    }
    if (req.method === "DELETE") {
      try {
        await rm(file);
        res.writeHead(204).end();
      } catch {
        send(res, 404, { error: "not found" });
      }
      return;
    }
    send(res, 405, { error: "method not allowed" });
  } catch (err) {
    send(res, 500, { error: String(err?.message ?? err) });
  }
}).listen(PORT, () => console.log(`Digital Twin storage API on http://localhost:${PORT} (data in ${ROOT})`));
