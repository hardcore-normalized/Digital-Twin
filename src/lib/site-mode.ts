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

export function isWebsiteOnly() {
  if (process.env.SITE_ONLY === "true") return true;
  if (process.env.SITE_ONLY === "false") return false;
  return Boolean(process.env.VERCEL) && !process.env.DATABASE_URL;
}
