import type { NextConfig } from "next";

const REPO_URL = "https://github.com/hardcore-normalized/Digital-Twin";

// Website-only mode (see src/lib/site-mode.ts): app routes go to GitHub instead.
const websiteOnly =
  process.env.SITE_ONLY === "true" || (process.env.SITE_ONLY !== "false" && Boolean(process.env.VERCEL) && !process.env.DATABASE_URL);

const nextConfig: NextConfig = {
  // PGlite ships a WASM build of Postgres; keep it out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  async redirects() {
    if (!websiteOnly) return [];
    return ["/app", "/app/:path*", "/sign-in", "/sign-up", "/api/:path*"].map((source) => ({
      source,
      destination: REPO_URL,
      permanent: false,
    }));
  },
};

export default nextConfig;
