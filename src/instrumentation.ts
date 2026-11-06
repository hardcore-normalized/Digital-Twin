/** Runs once when the server starts: turns on automatic daily syncs. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { isWebsiteOnly } = await import("./lib/site-mode");
  if (isWebsiteOnly()) return; // the public website has no database or syncs
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}
