"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "./db";
import { requireManager, requireUser, requireZone } from "./access";
import { actorFor, recordAudit } from "./audit";
import { encrypt, encryptJson } from "./crypto";
import { getStorage, testStorage, type HttpStorageConfig, type LocalStorageConfig, type S3StorageConfig, type TwinStorage } from "./storage";
import { builtinStorage } from "./storage/builtin";
import { httpStorage } from "./storage/http";
import { s3Storage } from "./storage/s3";
import { localFolderStorage, resolveLocalDir } from "./storage/local";
import { runSync } from "./sync";
import { testClaudeEnterprise } from "./providers/claude-enterprise";
import { refreshTwin } from "./twin/refresh";
import { aboutTemplate, writeTwinFile } from "./twin/files";
import Anthropic from "@anthropic-ai/sdk";
import { aiConfigFor } from "./ai";
import { presetById } from "./ai/presets";
import { friendlyAiError, testAi } from "./ai/llm";
import { LOCAL_BLOCKED_MESSAGE, checkEndpoint, localEndpointsAllowed } from "./ai/endpoints";

export type ActionResult = { ok: boolean; message?: string } | null;

const ok = (message?: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/* ───────────── Zones ───────────── */

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "zone"
  );
}

export async function createZone(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const name = str(fd, "name");
  const start = str(fd, "start"); // "demo" | "claude"
  if (name.length < 2) return fail("Enter your company name.");

  const db = await getDb();
  let slug = slugify(name);
  for (let i = 2; ; i++) {
    const [taken] = await db.select({ id: schema.zones.id }).from(schema.zones).where(eq(schema.zones.slug, slug));
    if (!taken) break;
    slug = `${slugify(name)}-${i}`;
  }

  // Daily sync defaults to 2 PM in the creator's own timezone (sent by their browser).
  const { isValidTimezone } = await import("./schedule-time");
  const tz = str(fd, "timezone");
  const [zone] = await db
    .insert(schema.zones)
    .values({ name, slug, syncTimezone: tz && isValidTimezone(tz) ? tz : "UTC" })
    .returning();
  await db.insert(schema.memberships).values({ zoneId: zone.id, userId: user.id, role: "owner" });
  await db.insert(schema.storageConfigs).values({ zoneId: zone.id, kind: "builtin" });
  await recordAudit(db, { zoneId: zone.id, actor: actorFor(user.email), action: "zone created", detail: name });

  if (start === "demo") {
    await db.insert(schema.connections).values({ zoneId: zone.id, provider: "demo", label: "Demo data (Acme)" });
    await runSync(zone.id, "demo");
    redirect(`/app/${slug}`);
  }
  redirect(`/app/${slug}/setup`);
}

export async function updateZone(slug: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireManager(slug);
  const name = str(fd, "name");
  if (name.length < 2) return fail("Name is too short.");
  const db = await getDb();
  await db.update(schema.zones).set({ name }).where(eq(schema.zones.id, ctx.zone.id));
  revalidatePath(`/app/${slug}`, "layout");
  return ok("Saved.");
}

export async function deleteZone(slug: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireZone(slug);
  if (ctx.role !== "owner") return fail("Only the owner can delete the zone.");
  if (str(fd, "confirm") !== ctx.zone.slug) return fail(`Type "${ctx.zone.slug}" to confirm.`);
  const db = await getDb();
  await db.delete(schema.zones).where(eq(schema.zones.id, ctx.zone.id));
  redirect("/app");
}

/* ───────────── Connections + sync ───────────── */

export async function addClaudeConnection(slug: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireManager(slug);
  const key = str(fd, "apiKey");
  const label = str(fd, "label") || "Claude Enterprise";
  if (key.length < 20) return fail("Paste the Analytics API key from claude.ai → Organization settings → API.");
  try {
    await testClaudeEnterprise(key);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
      return fail("Claude rejected this key. It must be an Analytics API key with the read:analytics scope, created by the Primary Owner.");
    if (err instanceof Anthropic.APIError) return fail(`Claude API error ${err.status}: ${err.message}`);
    return fail(`Could not reach the Claude API: ${(err as Error).message}`);
  }
  const db = await getDb();
  await db.insert(schema.connections).values({ zoneId: ctx.zone.id, provider: "claude_enterprise", label, secretEnc: encrypt(key) });
  await recordAudit(db, { zoneId: ctx.zone.id, actor: actorFor(ctx.user.email), action: "connection added", detail: label });
  revalidatePath(`/app/${slug}`, "layout");
  return ok("Connected. Run a sync to import the last 30 days.");
}

export async function addDemoConnection(slug: string): Promise<void> {
  const ctx = await requireManager(slug);
  const db = await getDb();
  const [exists] = await db
    .select()
    .from(schema.connections)
    .where(and(eq(schema.connections.zoneId, ctx.zone.id), eq(schema.connections.provider, "demo")));
  if (!exists) await db.insert(schema.connections).values({ zoneId: ctx.zone.id, provider: "demo", label: "Demo data (Acme)" });
  await runSync(ctx.zone.id, "demo");
  revalidatePath(`/app/${slug}`, "layout");
}

export async function removeConnection(slug: string, connectionId: string): Promise<void> {
  const ctx = await requireManager(slug);
  const db = await getDb();
  const [c] = await db
    .delete(schema.connections)
    .where(and(eq(schema.connections.id, connectionId), eq(schema.connections.zoneId, ctx.zone.id)))
    .returning();
  if (c) await recordAudit(db, { zoneId: ctx.zone.id, actor: actorFor(ctx.user.email), action: "connection removed", detail: c.label });
  revalidatePath(`/app/${slug}`, "layout");
}

export async function syncNow(slug: string, _prev: ActionResult): Promise<ActionResult> {
  const ctx = await requireManager(slug);
  try {
    const s = await runSync(ctx.zone.id, "manual");
    revalidatePath(`/app/${slug}`, "layout");
    const parts = [`${s.people} people`, `${s.events} new events`, `${s.twins.ai + s.twins.fallback} twins updated`];
    if (s.spikes) parts.push(`${s.spikes} usage spike(s)`);
    return s.warnings.length ? { ok: true, message: `Synced (${parts.join(", ")}). Note: ${s.warnings[0]}` } : ok(`Synced: ${parts.join(", ")}.`);
  } catch (err) {
    return fail(`Sync failed: ${(err as Error).message}`);
  }
}

/* ───────────── Storage ───────────── */

function storageFromForm(
  fd: FormData,
): { kind: "builtin" | "s3" | "http" | "local"; storage?: TwinStorage; config?: unknown; target?: string } | string {
  const kind = str(fd, "kind");
  if (kind === "builtin") return { kind };
  if (kind === "s3") {
    const config: S3StorageConfig = {
      bucket: str(fd, "bucket"),
      region: str(fd, "region") || "us-east-1",
      endpoint: str(fd, "endpoint") || undefined,
      accessKeyId: str(fd, "accessKeyId"),
      secretAccessKey: str(fd, "secretAccessKey"),
      prefix: str(fd, "prefix") || undefined,
      forcePathStyle: fd.get("forcePathStyle") === "on" || undefined,
    };
    if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) return "Bucket, access key ID and secret are required.";
    if (config.endpoint) {
      const check = checkEndpoint(config.endpoint);
      if ("error" in check) return check.error;
    }
    return { kind, config, storage: s3Storage(config), target: `s3://${config.bucket}/${config.prefix ?? ""}` };
  }
  if (kind === "http") {
    const config: HttpStorageConfig = { baseUrl: str(fd, "baseUrl"), token: str(fd, "token") };
    const check = checkEndpoint(config.baseUrl);
    if ("error" in check) return check.error;
    if (config.token.length < 8) return "Enter the bearer token your API expects (8+ characters).";
    return { kind, config, storage: httpStorage(config), target: config.baseUrl };
  }
  if (kind === "local") {
    if (!localEndpointsAllowed()) return LOCAL_BLOCKED_MESSAGE;
    const config: LocalStorageConfig = { dir: str(fd, "dir") };
    if (!config.dir.startsWith("/") && !config.dir.startsWith("~")) return "Enter a full folder path, like ~/DigitalTwin or /srv/digital-twin.";
    return { kind, config, storage: localFolderStorage(config), target: resolveLocalDir(config.dir) };
  }
  return "Pick a storage type.";
}

export async function saveStorage(slug: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireManager(slug);
  const parsed = storageFromForm(fd);
  if (typeof parsed === "string") return fail(parsed);
  const db = await getDb();
  const next = parsed.storage ?? builtinStorage(db, ctx.zone.id);

  try {
    await testStorage(next);
  } catch (err) {
    return fail(`Storage test failed, nothing was changed. ${(err as Error).message}`);
  }

  // Copy existing twin files to the new location so nothing is lost.
  let copied = 0;
  if (fd.get("copy") === "on") {
    const prev = await getStorage(db, ctx.zone.id);
    try {
      for (const f of await prev.list("twins/")) {
        const body = await prev.read(f.path);
        if (body !== null) {
          await next.write(f.path, body);
          copied++;
        }
      }
    } catch (err) {
      return fail(`Copying files failed, nothing was changed. ${(err as Error).message}`);
    }
  }

  const values = {
    kind: parsed.kind,
    configEnc: parsed.config ? encryptJson(parsed.config) : null,
    displayTarget: parsed.target ?? null,
    lastTestAt: new Date(),
    lastTestOk: true,
    lastTestError: null,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.storageConfigs)
    .values({ zoneId: ctx.zone.id, ...values })
    .onConflictDoUpdate({ target: schema.storageConfigs.zoneId, set: values });
  await recordAudit(db, {
    zoneId: ctx.zone.id,
    actor: actorFor(ctx.user.email),
    action: "storage changed",
    detail: `${parsed.kind}${parsed.target ? ` → ${parsed.target}` : ""}${copied ? ` (copied ${copied} files)` : ""}`,
  });
  revalidatePath(`/app/${slug}`, "layout");
  return ok(`Storage saved and tested${copied ? `; copied ${copied} files` : ""}.`);
}

export async function testCurrentStorage(slug: string, _prev: ActionResult): Promise<ActionResult> {
  const ctx = await requireManager(slug);
  const db = await getDb();
  let error: string | null = null;
  try {
    await testStorage(await getStorage(db, ctx.zone.id));
  } catch (err) {
    error = (err as Error).message;
  }
  await db
    .update(schema.storageConfigs)
    .set({ lastTestAt: new Date(), lastTestOk: !error, lastTestError: error })
    .where(eq(schema.storageConfigs.zoneId, ctx.zone.id));
  revalidatePath(`/app/${slug}/settings/storage`);
  return error ? fail(error) : ok("Storage is working: wrote, read and deleted a test file.");
}

/* ───────────── AI settings ───────────── */

export async function saveAiSettings(slug: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireManager(slug);
  const zone = ctx.zone;
  const preset = presetById(str(fd, "preset"));
  if (preset.id !== str(fd, "preset")) return fail("Pick an AI provider.");

  const model = str(fd, "model");
  if (!model || model.length > 200) return fail("Enter the model name.");
  if (preset.models && !preset.models.some((m) => m.id === model)) return fail("Pick a model.");

  let baseUrl: string | null = null;
  if (preset.kind === "openai") {
    const raw = str(fd, "baseUrl") || preset.baseUrl;
    const check = checkEndpoint(raw);
    if ("error" in check) return fail(check.error);
    baseUrl = check.url.toString().replace(/\/$/, "");
  }

  // Keep the saved key when the provider didn't change and no new key was pasted.
  const newKey = str(fd, "apiKey");
  const sameProvider = zone.aiProvider === preset.id;
  const keyEnc = newKey ? encrypt(newKey) : sameProvider ? zone.aiKeyEnc : null;

  const candidate = { aiProvider: preset.id, aiBaseUrl: baseUrl, aiKeyEnc: keyEnc, aiModel: model };
  const cfg = aiConfigFor(candidate);
  if (!cfg) return fail(preset.keyRequired ? `Paste your ${preset.label} API key.` : "Enter the server address and model name.");

  // Only re-test when something about the model changed (so toggling check-ins
  // works even while a local model is switched off).
  const changed = !sameProvider || newKey || zone.aiBaseUrl !== baseUrl || zone.aiModel !== model || !aiConfigFor(zone);
  if (changed) {
    try {
      await testAi(cfg);
    } catch (err) {
      return fail(`Couldn't use this model, nothing was saved. ${friendlyAiError(cfg, err)}`);
    }
  }

  const includeCheckins = fd.get("includeCheckins") === "on";
  const db = await getDb();
  await db
    .update(schema.zones)
    .set({ ...candidate, includeCheckins })
    .where(eq(schema.zones.id, zone.id));
  await recordAudit(db, {
    zoneId: zone.id,
    actor: actorFor(ctx.user.email),
    action: "AI settings changed",
    detail: `${preset.label} · ${model}${baseUrl ? ` at ${baseUrl}` : ""}${newKey ? ", new API key" : ""}; check-ins ${includeCheckins ? "shared with twins" : "hidden from twins"}`,
  });
  revalidatePath(`/app/${slug}`, "layout");
  return ok(changed ? "Connected and saved." : "Saved.");
}

export async function resetAiModel(slug: string): Promise<void> {
  const ctx = await requireManager(slug);
  const db = await getDb();
  await db
    .update(schema.zones)
    .set({ aiProvider: "anthropic", aiBaseUrl: null, aiKeyEnc: null, aiModel: "claude-opus-5-5" })
    .where(eq(schema.zones.id, ctx.zone.id));
  await recordAudit(db, { zoneId: ctx.zone.id, actor: actorFor(ctx.user.email), action: "AI settings changed", detail: "AI model removed" });
  revalidatePath(`/app/${slug}`, "layout");
}

/* ───────────── People + twins ───────────── */

const PersonInput = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  team: z.string().max(80).optional(),
  title: z.string().max(120).optional(),
  seat: z.string().max(80).optional(),
});

export async function addPerson(slug: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireManager(slug);
  const parsed = PersonInput.safeParse({
    email: str(fd, "email").toLowerCase(),
    name: str(fd, "name") || undefined,
    team: str(fd, "team") || undefined,
    title: str(fd, "title") || undefined,
    seat: str(fd, "seat") || undefined,
  });
  if (!parsed.success) return fail("Enter a valid work email.");
  const db = await getDb();
  const [person] = await db
    .insert(schema.people)
    .values({ zoneId: ctx.zone.id, ...parsed.data })
    .onConflictDoNothing()
    .returning();
  if (!person) return fail("That person is already in this zone.");
  await recordAudit(db, { zoneId: ctx.zone.id, personId: person.id, actor: actorFor(ctx.user.email), action: "person added", detail: "Added manually" });
  await refreshTwin(db, await getStorage(db, ctx.zone.id), ctx.zone, person);
  revalidatePath(`/app/${slug}`, "layout");
  return ok(`Added ${person.email}. Their twin files were created.`);
}

export async function updatePerson(slug: string, personId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireManager(slug);
  const db = await getDb();
  const patch = {
    name: str(fd, "name") || null,
    team: str(fd, "team") || null,
    title: str(fd, "title") || null,
    seat: str(fd, "seat") || null,
    status: (str(fd, "status") === "removed" ? "removed" : "active") as "active" | "removed",
  };
  const [p] = await db
    .update(schema.people)
    .set(patch)
    .where(and(eq(schema.people.id, personId), eq(schema.people.zoneId, ctx.zone.id)))
    .returning();
  if (!p) return fail("Person not found.");
  await recordAudit(db, { zoneId: ctx.zone.id, personId, actor: actorFor(ctx.user.email), action: "person updated", detail: `team ${p.team ?? "—"}, title ${p.title ?? "—"}, status ${p.status}` });
  revalidatePath(`/app/${slug}`, "layout");
  return ok("Saved.");
}

async function personForEdit(slug: string, personId: string) {
  const ctx = await requireZone(slug);
  if (!ctx.canManage && ctx.self?.id !== personId) throw new Error("Not allowed");
  const db = await getDb();
  const [person] = await db
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.id, personId), eq(schema.people.zoneId, ctx.zone.id)));
  if (!person) throw new Error("Person not found");
  return { ctx, db, person };
}

export async function saveAbout(slug: string, personId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { ctx, db, person } = await personForEdit(slug, personId);
  const content = String(fd.get("content") ?? "");
  if (content.length > 20_000) return fail("ABOUT.md is limited to 20,000 characters.");
  const storage = await getStorage(db, ctx.zone.id);
  try {
    await writeTwinFile(storage, person, "ABOUT.md", content.trim() ? content.replace(/\r\n/g, "\n") : aboutTemplate(person));
  } catch (err) {
    return fail(`Could not save to storage: ${(err as Error).message}`);
  }
  await recordAudit(db, { zoneId: ctx.zone.id, personId, actor: actorFor(ctx.user.email), action: "ABOUT.md edited", detail: `${content.length} characters` });
  revalidatePath(`/app/${slug}`, "layout");
  return ok("Saved. The previous version is in history.");
}

export async function restoreVersion(slug: string, personId: string, path: string): Promise<void> {
  const { ctx, db, person } = await personForEdit(slug, personId);
  const { isHistoryPathFor } = await import("./twin/files");
  if (!isHistoryPathFor(person, "ABOUT.md", path)) throw new Error("Only ABOUT.md versions can be restored.");
  const storage = await getStorage(db, ctx.zone.id);
  const body = await storage.read(path);
  if (body === null) throw new Error("That version no longer exists.");
  await writeTwinFile(storage, person, "ABOUT.md", body);
  await recordAudit(db, { zoneId: ctx.zone.id, personId, actor: actorFor(ctx.user.email), action: "ABOUT.md restored", detail: path.split("/").pop() ?? path });
  revalidatePath(`/app/${slug}`, "layout");
}

export async function submitCheckin(slug: string, personId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { ctx, db, person } = await personForEdit(slug, personId);
  if (ctx.self?.id !== personId) return fail("Only the person can post their own check-in.");
  const text = str(fd, "text");
  if (text.length < 3) return fail("Write a short update first.");
  if (text.length > 1000) return fail("Keep check-ins under 1,000 characters.");
  const now = new Date();
  await db.insert(schema.events).values({
    zoneId: ctx.zone.id,
    personId,
    source: "checkin",
    type: "checkin",
    occurredAt: now,
    summary: text,
    dedupeKey: `checkin:${personId}:${now.toISOString()}`,
  });
  const result = await refreshTwin(db, await getStorage(db, ctx.zone.id), ctx.zone, person);
  revalidatePath(`/app/${slug}`, "layout");
  return ok(result.progress === "ai" ? "Posted. Your twin updated PROGRESS.md." : "Posted and added to PROGRESS.md.");
}

export async function regenerateTwin(slug: string, personId: string, _prev: ActionResult): Promise<ActionResult> {
  const { ctx, db, person } = await personForEdit(slug, personId);
  // Re-fold the last 120 days of events from scratch.
  await db.update(schema.events).set({ processedAt: null }).where(eq(schema.events.personId, personId));
  const storage = await getStorage(db, ctx.zone.id);
  const result = await refreshTwin(db, storage, ctx.zone, person, { rebuild: true });
  await recordAudit(db, { zoneId: ctx.zone.id, personId, actor: actorFor(ctx.user.email), action: "twin regenerated", detail: `PROGRESS.md rebuilt (${result.progress})` });
  revalidatePath(`/app/${slug}`, "layout");
  if (result.error) return fail(`Rebuilt without AI: ${result.error}`);
  return ok(result.progress === "ai" ? "PROGRESS.md rebuilt by the twin." : "PROGRESS.md rebuilt (no AI key set, so a plain summary was used).");
}

/* ───────────── Access ───────────── */

export async function inviteMember(slug: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireManager(slug);
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role") === "admin" ? "admin" : "member";
  if (!z.string().email().safeParse(email).success) return fail("Enter a valid email.");
  const db = await getDb();
  const [existingUser] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  if (existingUser) {
    await db
      .insert(schema.memberships)
      .values({ zoneId: ctx.zone.id, userId: existingUser.id, role })
      .onConflictDoUpdate({ target: [schema.memberships.zoneId, schema.memberships.userId], set: { role } });
  } else {
    await db
      .insert(schema.zoneInvites)
      .values({ zoneId: ctx.zone.id, email, role })
      .onConflictDoUpdate({ target: [schema.zoneInvites.zoneId, schema.zoneInvites.email], set: { role } });
  }
  await recordAudit(db, { zoneId: ctx.zone.id, actor: actorFor(ctx.user.email), action: "access granted", detail: `${email} as ${role}` });
  revalidatePath(`/app/${slug}/settings/access`);
  return ok(existingUser ? `${email} now has ${role} access.` : `${email} will get ${role} access when they sign up with that email.`);
}

export async function removeAccess(slug: string, userId: string | null, inviteId: string | null): Promise<void> {
  const ctx = await requireManager(slug);
  const db = await getDb();
  if (userId) {
    if (userId === ctx.user.id) throw new Error("You can't remove yourself.");
    const [m] = await db
      .select()
      .from(schema.memberships)
      .where(and(eq(schema.memberships.zoneId, ctx.zone.id), eq(schema.memberships.userId, userId)));
    if (m?.role === "owner") throw new Error("The owner can't be removed.");
    await db.delete(schema.memberships).where(and(eq(schema.memberships.zoneId, ctx.zone.id), eq(schema.memberships.userId, userId)));
  }
  if (inviteId)
    await db.delete(schema.zoneInvites).where(and(eq(schema.zoneInvites.zoneId, ctx.zone.id), eq(schema.zoneInvites.id, inviteId)));
  await recordAudit(db, { zoneId: ctx.zone.id, actor: actorFor(ctx.user.email), action: "access removed", detail: userId ?? inviteId ?? "" });
  revalidatePath(`/app/${slug}/settings/access`);
}

export async function readVersion(slug: string, personId: string, name: "ABOUT.md" | "PROGRESS.md", path: string): Promise<string | null> {
  const { ctx, db, person } = await personForEdit(slug, personId);
  const { isHistoryPathFor } = await import("./twin/files");
  if (!isHistoryPathFor(person, name, path)) return null;
  return (await getStorage(db, ctx.zone.id)).read(path);
}

/* ───────────── Company SSO ───────────── */

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "icloud.com",
  "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "zoho.com", "yandex.com",
]);

async function ssoFor(slug: string) {
  const ctx = await requireManager(slug);
  const { ssoProviderIdFor } = await import("./sso");
  const db = await getDb();
  const providerId = ssoProviderIdFor(ctx.zone.id);
  const [row] = await db.select().from(schema.ssoProvider).where(eq(schema.ssoProvider.providerId, providerId));
  return { ctx, db, providerId, row: row ?? null };
}

export async function saveZoneSso(slug: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const { ctx, db, providerId, row } = await ssoFor(slug);
  const { ssoTrustedIssuers, getAuth } = await import("./auth");
  const { checkSsoDomain } = await import("./sso");
  const { headers } = await import("next/headers");

  const issuer = str(fd, "issuer").replace(/\/+$/, "");
  const clientId = str(fd, "clientId");
  const clientSecret = str(fd, "clientSecret");
  const domain = str(fd, "domain").toLowerCase().replace(/^@/, "");

  let issuerUrl: URL;
  try {
    issuerUrl = new URL(issuer);
  } catch {
    return fail("Enter your identity provider's issuer URL, like https://login.microsoftonline.com/<tenant-id>/v2.0");
  }
  if (issuerUrl.protocol !== "https:") return fail("The issuer URL must start with https://");
  if (!ssoTrustedIssuers().some((o) => o === issuerUrl.origin))
    return fail(`This server doesn't trust ${issuerUrl.origin} yet. Whoever runs Digital Twin can add it to SSO_TRUSTED_ISSUERS.`);
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return fail("Enter your company's email domain, like acme.com");
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) return fail("Use your company's own email domain, not a public one.");
  if (!clientId) return fail("Enter the client ID from your identity provider.");
  if (!clientSecret && !row) return fail("Enter the client secret from your identity provider.");

  // Re-register with the new details (keeps the old secret if none was pasted).
  let secret = clientSecret;
  if (!secret && row?.oidcConfig) secret = (JSON.parse(row.oidcConfig) as { clientSecret?: string }).clientSecret ?? "";
  if (row) await db.delete(schema.ssoProvider).where(eq(schema.ssoProvider.providerId, providerId));

  try {
    const auth = await getAuth();
    await auth.api.registerSSOProvider({
      body: { providerId, issuer, domain, oidcConfig: { clientId, clientSecret: secret, scopes: ["openid", "email", "profile"], pkce: true } },
      headers: await headers(),
    });
  } catch (err) {
    return fail(`Couldn't set up SSO: ${(err as Error).message}`);
  }

  // If the DNS record is already in place, mark the domain verified right away.
  const verified = await checkSsoDomain(providerId, domain).catch(() => false);
  if (verified) await db.update(schema.ssoProvider).set({ domainVerified: true }).where(eq(schema.ssoProvider.providerId, providerId));

  await recordAudit(db, { zoneId: ctx.zone.id, actor: actorFor(ctx.user.email), action: "SSO configured", detail: `${issuerUrl.origin} for @${domain}` });
  revalidatePath(`/app/${slug}/settings/access`);
  return ok(verified ? "SSO is on. People at your domain can now sign in with it." : "Saved. Add the DNS record below to verify your domain and turn SSO on.");
}

export async function verifyZoneSso(slug: string, _prev: ActionResult): Promise<ActionResult> {
  const { ctx, db, providerId, row } = await ssoFor(slug);
  if (!row) return fail("Set up SSO first.");
  const { checkSsoDomain, ssoDnsRecord } = await import("./sso");
  const verified = await checkSsoDomain(providerId, row.domain).catch(() => false);
  if (!verified) {
    const rec = ssoDnsRecord(providerId, row.domain);
    return fail(`Couldn't find the TXT record yet. Add ${rec.name} with the value shown and try again (DNS can take a few minutes).`);
  }
  await db.update(schema.ssoProvider).set({ domainVerified: true }).where(eq(schema.ssoProvider.providerId, providerId));
  await recordAudit(db, { zoneId: ctx.zone.id, actor: actorFor(ctx.user.email), action: "SSO domain verified", detail: `@${row.domain}` });
  revalidatePath(`/app/${slug}/settings/access`);
  return ok("Domain verified. SSO is on.");
}

export async function removeZoneSso(slug: string): Promise<void> {
  const { ctx, db, providerId, row } = await ssoFor(slug);
  if (!row) return;
  await db.delete(schema.ssoProvider).where(eq(schema.ssoProvider.providerId, providerId));
  await recordAudit(db, { zoneId: ctx.zone.id, actor: actorFor(ctx.user.email), action: "SSO removed", detail: `@${row.domain}` });
  revalidatePath(`/app/${slug}/settings/access`);
}

/* ───────────── Automatic sync schedule ───────────── */

export async function saveSyncSchedule(slug: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await requireManager(slug);
  const { isValidTime, isValidTimezone } = await import("./schedule-time");
  const enabled = fd.get("enabled") === "on";
  const time = str(fd, "time");
  const tz = str(fd, "timezone");
  if (!isValidTime(time)) return fail("Pick a time of day.");
  if (!isValidTimezone(tz)) return fail("Pick a timezone.");
  const db = await getDb();
  await db.update(schema.zones).set({ syncEnabled: enabled, syncTime: time, syncTimezone: tz }).where(eq(schema.zones.id, ctx.zone.id));
  await recordAudit(db, {
    zoneId: ctx.zone.id,
    actor: actorFor(ctx.user.email),
    action: "sync schedule changed",
    detail: enabled ? `every day at ${time} (${tz})` : "automatic sync turned off",
  });
  revalidatePath(`/app/${slug}`, "layout");
  return ok(enabled ? `Saved. Syncs every day at ${time} (${tz}).` : "Saved. Automatic sync is off; use Sync now instead.");
}
