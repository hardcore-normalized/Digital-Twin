/**
 * The public website (digital-twin's own homepage) runs in "website-only" mode:
 * no database, no sign-in, and download links point to GitHub. People run the
 * actual app themselves from the GitHub repo.
 *
 *   SITE_ONLY=true   website only
 *   SITE_ONLY=false  full app
 *   (unset)          website only when deployed on Vercel without a DATABASE_URL
 */
export const GITHUB_REPO = "hardcore-normalized/Digital-Twin";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const GUIDE_URL = `${GITHUB_URL}/blob/main/docs/GUIDE.md`;

export function isWebsiteOnly() {
  if (process.env.SITE_ONLY === "true") return true;
  if (process.env.SITE_ONLY === "false") return false;
  return Boolean(process.env.VERCEL) && !process.env.DATABASE_URL;
}

/**
 * The website includes a read-only live demo at /app/acme: a fictional company
 * built in memory on each server, browsed without signing in. Every action
 * that would change data is refused.
 */
export const DEMO_SLUG = "acme";
export const DEMO_PATH = `/app/${DEMO_SLUG}`;
export const DEMO_ZONE_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_READ_ONLY = "This is a read-only demo. Download Digital Twin from GitHub to use it with your own data.";

export function isLiveDemo() {
  return isWebsiteOnly();
}
