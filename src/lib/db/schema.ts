import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ───────────────────────── Auth (Better Auth) ───────────────────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Company SSO (OIDC) providers, managed by @better-auth/sso. One per zone, created from Settings → Access. */
export const ssoProvider = pgTable("sso_provider", {
  id: text("id").primaryKey(),
  issuer: text("issuer").notNull(),
  oidcConfig: text("oidc_config"),
  samlConfig: text("saml_config"),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull().unique(),
  organizationId: text("organization_id"),
  domain: text("domain").notNull(),
  /** Set once the company proves it owns the domain with a DNS TXT record. */
  domainVerified: boolean("domain_verified"),
});

/** Passkeys (Face ID, Touch ID, Windows Hello, security keys), managed by @better-auth/passkey. */
export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    aaguid: text("aaguid"),
  },
  (t) => [index("passkey_user_idx").on(t.userId), index("passkey_credential_idx").on(t.credentialID)],
);

/* ───────────────────────── Zones (customer companies) ───────────────────────── */

export type ZoneRole = "owner" | "admin" | "member";

export const zones = pgTable("zones", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /**
   * AI model used for twin chat and PROGRESS.md summaries (bring your own):
   * a preset id from src/lib/ai/presets.ts, e.g. "anthropic", "openai", "ollama", "custom".
   */
  aiProvider: text("ai_provider").notNull().default("anthropic"),
  /** Base URL for OpenAI-compatible providers, e.g. http://localhost:11434/v1 for Ollama. */
  aiBaseUrl: text("ai_base_url"),
  /** The provider's API key, encrypted. (Column keeps its original name from when only Claude was supported.) */
  aiKeyEnc: text("anthropic_key_enc"),
  aiModel: text("ai_model").notNull().default("claude-opus-5-5"),
  /** When false, twins never see self-reported check-in text (only metadata). */
  includeCheckins: boolean("include_checkins").notNull().default(true),
  /** Automatic daily sync. Admins can change the time and timezone in Settings → Connections. */
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  /** Local time of day, "HH:MM" (24h). */
  syncTime: text("sync_time").notNull().default("14:00"),
  /** IANA timezone the sync time is in, e.g. "Asia/Kolkata". */
  syncTimezone: text("sync_timezone").notNull().default("UTC"),
  createdAt: createdAt(),
});

/** Dashboard access: who can log in to a zone and with which role. */
export const memberships = pgTable(
  "memberships",
  {
    zoneId: text("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<ZoneRole>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.zoneId, t.userId] })],
);

/** Pending dashboard access for someone who has not signed up yet. */
export const zoneInvites = pgTable(
  "zone_invites",
  {
    id: id(),
    zoneId: text("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<ZoneRole>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("zone_invites_zone_email").on(t.zoneId, t.email)],
);

/* ───────────────────────── People + twins ───────────────────────── */

export const people = pgTable(
  "people",
  {
    id: id(),
    zoneId: text("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    title: text("title"),
    team: text("team"),
    /** e.g. "Enterprise", "Premium" — whatever the provider reports, or set by the owner. */
    seat: text("seat"),
    status: text("status").$type<"active" | "removed">().notNull().default("active"),
    /** Provider user id, e.g. Claude's `user_...`. */
    externalId: text("external_id"),
    lastActiveDate: text("last_active_date"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("people_zone_email").on(t.zoneId, t.email)],
);

/** One row per person, per day, per product. Source of truth for every number. */
export const usageDaily = pgTable(
  "usage_daily",
  {
    id: id(),
    zoneId: text("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD (UTC)
    product: text("product").notNull(), // chat | claude_code | cowork | other
    costCents: doublePrecision("cost_cents").notNull().default(0),
    messages: integer("messages").notNull().default(0),
    conversations: integer("conversations").notNull().default(0),
    sessions: integer("sessions").notNull().default(0),
    commits: integer("commits").notNull().default(0),
    pullRequests: integer("pull_requests").notNull().default(0),
    linesAdded: integer("lines_added").notNull().default(0),
    linesRemoved: integer("lines_removed").notNull().default(0),
  },
  (t) => [
    uniqueIndex("usage_daily_person_date_product").on(t.personId, t.date, t.product),
    index("usage_daily_zone_date").on(t.zoneId, t.date),
  ],
);

/** Things that happened to/for a person. Feeds PROGRESS.md. */
export const events = pgTable(
  "events",
  {
    id: id(),
    zoneId: text("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    source: text("source").$type<"claude" | "checkin" | "github" | "system">().notNull(),
    type: text("type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    summary: text("summary").notNull(),
    data: jsonb("data"),
    /** Set once the event has been folded into PROGRESS.md. */
    processedAt: timestamp("processed_at", { withTimezone: true }),
    /** De-duplicates events created by repeated syncs. */
    dedupeKey: text("dedupe_key"),
  },
  (t) => [
    index("events_person_time").on(t.personId, t.occurredAt),
    uniqueIndex("events_dedupe").on(t.zoneId, t.dedupeKey),
  ],
);

/** Append-only. Rendered into each person's AUDIT_LOG.md. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    zoneId: text("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => people.id, { onDelete: "set null" }),
    actor: text("actor").notNull(), // "system" or "user:<email>"
    action: text("action").notNull(),
    detail: text("detail").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_zone_time").on(t.zoneId, t.createdAt)],
);

/* ───────────────────────── Connections, storage, sync ───────────────────────── */

export type ConnectionProvider = "claude_enterprise" | "demo";

export const connections = pgTable("connections", {
  id: id(),
  zoneId: text("zone_id")
    .notNull()
    .references(() => zones.id, { onDelete: "cascade" }),
  provider: text("provider").$type<ConnectionProvider>().notNull(),
  label: text("label").notNull(),
  secretEnc: text("secret_enc"),
  status: text("status").$type<"ok" | "error" | "never_synced">().notNull().default("never_synced"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastError: text("last_error"),
  /** Most recent day fully imported (YYYY-MM-DD). */
  syncedThrough: text("synced_through"),
  createdAt: createdAt(),
});

export type StorageKind = "builtin" | "s3" | "http" | "local";

export const storageConfigs = pgTable("storage_configs", {
  zoneId: text("zone_id")
    .primaryKey()
    .references(() => zones.id, { onDelete: "cascade" }),
  kind: text("kind").$type<StorageKind>().notNull().default("builtin"),
  /** Encrypted JSON with the adapter's settings + credentials. */
  configEnc: text("config_enc"),
  /** Non-secret summary shown in the UI, e.g. bucket name or base URL. */
  displayTarget: text("display_target"),
  lastTestAt: timestamp("last_test_at", { withTimezone: true }),
  lastTestOk: boolean("last_test_ok"),
  lastTestError: text("last_test_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Built-in storage backend: twin files kept in our database. */
export const storedFiles = pgTable(
  "stored_files",
  {
    zoneId: text("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.zoneId, t.path] })],
);

export const syncRuns = pgTable("sync_runs", {
  id: id(),
  zoneId: text("zone_id")
    .notNull()
    .references(() => zones.id, { onDelete: "cascade" }),
  trigger: text("trigger").notNull(), // manual | cron | demo
  status: text("status").$type<"running" | "ok" | "error">().notNull(),
  stats: jsonb("stats"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/* ───────────────────────── Twin chat ───────────────────────── */

export const chatThreads = pgTable("chat_threads", {
  id: id(),
  zoneId: text("zone_id")
    .notNull()
    .references(() => zones.id, { onDelete: "cascade" }),
  personId: text("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: createdAt(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: id(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    /** Plain text shown in the UI. */
    text: text("text").notNull(),
    /** Full API content blocks (tool calls etc.), replayed on the next turn. */
    content: jsonb("content").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("chat_messages_thread").on(t.threadId, t.createdAt)],
);
