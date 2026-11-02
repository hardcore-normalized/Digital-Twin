import "server-only";
import net from "node:net";

/**
 * Local addresses (localhost, LAN IPs) and server folders are allowed when you
 * run Digital Twin yourself. On a shared/public server they would let users
 * reach into that server's network or disk, so they're off unless enabled.
 *
 *   ALLOW_LOCAL_ENDPOINTS=true   always allow
 *   ALLOW_LOCAL_ENDPOINTS=false  never allow
 *   (unset)                      allowed in development, blocked in production
 */
export function localEndpointsAllowed() {
  const v = process.env.ALLOW_LOCAL_ENDPOINTS;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export const LOCAL_BLOCKED_MESSAGE =
  "Local addresses and folders are turned off on this server. If you run Digital Twin yourself, set ALLOW_LOCAL_ENDPOINTS=true.";

export function isLocalHost(hostname: string) {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h === "host.docker.internal") return true;
  if (net.isIPv4(h)) {
    const [a, b] = h.split(".").map(Number);
    return a === 127 || a === 10 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  if (net.isIPv6(h)) return h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80");
  return false;
}

/** Validates a user-supplied endpoint URL. Remote endpoints must use https. */
export function checkEndpoint(raw: string): { url: URL; local: boolean } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "Enter a full URL, like https://example.com/v1 or http://localhost:11434/v1" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { error: "The URL must start with http:// or https://" };
  const local = isLocalHost(url.hostname);
  if (local && !localEndpointsAllowed()) return { error: LOCAL_BLOCKED_MESSAGE };
  if (!local && url.protocol !== "https:") return { error: "Remote addresses must use https:// (http:// is only for local addresses)." };
  return { url, local };
}
