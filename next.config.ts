import type { NextConfig } from "next";

const REPO_URL = "https://github.com/hardcore-normalized/Digital-Twin";
const DEMO_PATH = "/app/acme"; // keep in sync with src/lib/site-mode.ts

// Website-only mode (see src/lib/site-mode.ts): the read-only demo lives at
// /app/acme; signing in, other zones and auth/cron endpoints go to GitHub.
const websiteOnly =
  process.env.SITE_ONLY === "true" || (process.env.SITE_ONLY !== "false" && Boolean(process.env.VERCEL) && !process.env.DATABASE_URL);

const nextConfig: NextConfig = {
  // PGlite ships a WASM build of Postgres; keep it out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Migrations are read from disk at runtime, so ship them with the server code.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  async redirects() {
    if (!websiteOnly) return [];
    const toDemo = ["/app", "/app/new", "/app/account"];
    const toGithub = ["/sign-in", "/sign-up", "/api/auth/:path*", "/api/cron/:path*", "/api/zones/:zoneId/twins/:path*"];
    return [
      // Other zone URLs need no rule: they redirect to /app, and so to the demo.
      ...toDemo.map((source) => ({ source, destination: DEMO_PATH, permanent: false })),
      ...toGithub.map((source) => ({ source, destination: REPO_URL, permanent: false })),
    ];
  },
};

export default nextConfig;
