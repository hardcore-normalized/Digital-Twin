import Link from "next/link";
import { Activity, AlertTriangle, MessageSquareText, PenLine } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { SpendChart } from "@/components/charts";
import { TwinChat } from "@/components/twin-chat";
import { TwinFiles } from "@/components/twin-files";
import { Avatar, Badge, Card, CardHeader, Field, Input, Select, StatTile, Textarea, cn } from "@/components/ui";
import type { ZoneContext } from "@/lib/access";
import { readVersion, regenerateTwin, restoreVersion, saveAbout, submitCheckin, updatePerson } from "@/lib/actions";
import { getDb, schema } from "@/lib/db";
import { daysBetween, displayName, initials, money, num, relativeDay, todayUtc } from "@/lib/format";
import { getPersonDaily, getPersonEvents, getStorageConfig, getThreadMessages, getThreads } from "@/lib/queries";
import { getStorage } from "@/lib/storage";
import { aiSource } from "@/lib/ai";
import { isLiveDemo } from "@/lib/site-mode";
import { FILE_INFO, TWIN_FILES, listHistory, readTwinFile } from "@/lib/twin/files";

type Person = typeof schema.people.$inferSelect;
type Ctx = NonNullable<ZoneContext>;
export type PersonTab = "chat" | "files" | "usage" | "activity" | "manage";

export async function PersonView({
  ctx,
  person,
  tab,
  threadId,
  basePath,
}: {
  ctx: Ctx;
  person: Person;
  tab: PersonTab;
  threadId: string | null;
  basePath: string;
}) {
  const slug = ctx.zone.slug;
  const isSelf = ctx.self?.id === person.id;
  const first = displayName(person).split(" ")[0];
  const idle = person.status === "active" && (!person.lastActiveDate || daysBetween(person.lastActiveDate, todayUtc()) > 14);

  const tabs: { key: PersonTab; label: string }[] = [
    { key: "chat", label: isSelf ? "Ask my twin" : "Ask the twin" },
    { key: "files", label: "Twin files" },
    { key: "usage", label: "Usage" },
    { key: "activity", label: "Activity" },
    ...(ctx.canManage ? [{ key: "manage" as const, label: "Settings" }] : []),
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar initials={initials(person.name, person.email)} seed={person.email} size={52} />
          <div className="min-w-0">
            <h1 className="font-serif text-[28px] leading-tight font-medium">{isSelf ? "My twin" : displayName(person)}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-2">
              <span>{person.email}</span>
              {(person.title || person.team) && <span>· {[person.title, person.team].filter(Boolean).join(", ")}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {person.seat && <Badge>{person.seat}</Badge>}
              {person.status === "removed" ? <Badge tone="danger">Removed</Badge> : idle ? <Badge tone="warn">Idle</Badge> : <Badge tone="ok">Active</Badge>}
              <Badge>Last active {relativeDay(person.lastActiveDate).toLowerCase()}</Badge>
            </div>
          </div>
        </div>
        <ActionButton action={regenerateTwin.bind(null, slug, person.id)} label="Rebuild PROGRESS.md" pendingLabel="Rebuilding…" size="sm" />
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`${basePath}?tab=${t.key}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap",
              tab === t.key ? "border-accent font-medium text-text" : "border-transparent text-text-2 hover:text-text",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "chat" && <ChatTab ctx={ctx} person={person} threadId={threadId} basePath={basePath} first={first} isSelf={isSelf} />}
      {tab === "files" && <FilesTab ctx={ctx} person={person} isSelf={isSelf} />}
      {tab === "usage" && <UsageTab person={person} first={first} />}
      {tab === "activity" && <ActivityTab ctx={ctx} person={person} isSelf={isSelf} />}
      {tab === "manage" && ctx.canManage && <ManageTab slug={slug} person={person} />}
    </>
  );
}

async function ChatTab({ ctx, person, threadId, basePath, first, isSelf }: { ctx: Ctx; person: Person; threadId: string | null; basePath: string; first: string; isSelf: boolean }) {
  const [threads, thread] = await Promise.all([
    getThreads(person.id, ctx.user.id),
    threadId ? getThreadMessages(threadId, ctx.user.id) : Promise.resolve(null),
  ]);
  const suggestions = isSelf
    ? ["Write my standup update for today", "How much have I used Claude this month?", "What did I work on last week?", "Who has asked my twin questions?"]
    : [
        `What has ${first} been working on this week?`,
        `How much did ${first} spend on AI this month, and is that normal?`,
        `Which Claude products does ${first} use most?`,
        `Summarize ${first}'s last two weeks for a 1:1`,
      ];
  return (
    <>
      {isSelf && <CheckinCard slug={ctx.zone.slug} personId={person.id} />}
      <TwinChat
        key={thread?.thread.id ?? "new"}
        zoneId={ctx.zone.id}
        personId={person.id}
        firstName={isSelf ? "your" : first}
        initialThreadId={thread?.thread.id ?? null}
        initialMessages={thread?.messages ?? []}
        threads={threads.map((t) => ({ id: t.id, title: t.title, createdAt: t.createdAt.toISOString() }))}
        basePath={`${basePath}?tab=chat`}
        suggestions={suggestions}
        aiReady={aiSource(ctx.zone) !== null}
        settingsHref={ctx.canManage ? `/app/${ctx.zone.slug}/settings/ai` : null}
        demo={isLiveDemo()}
      />
    </>
  );
}

function CheckinCard({ slug, personId }: { slug: string; personId: string }) {
  return (
    <Card className="mb-5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <PenLine size={16} className="text-accent" />
        <h2 className="text-[15px] font-semibold">Post a check-in</h2>
      </div>
      <p className="mb-3 text-[13px] text-text-2">
        A sentence or two on what you worked on. Your twin folds it into PROGRESS.md, so answers about you use your own words.
      </p>
      <ActionForm action={submitCheckin.bind(null, slug, personId)} submitLabel="Post check-in" pendingLabel="Posting…">
        <Textarea name="text" rows={2} maxLength={1000} placeholder="Finished the retry logic for failed refunds; PR is up for review." required />
      </ActionForm>
    </Card>
  );
}

async function FilesTab({ ctx, person, isSelf }: { ctx: Ctx; person: Person; isSelf: boolean }) {
  const db = await getDb();
  const storage = await getStorage(db, ctx.zone.id);
  const cfg = await getStorageConfig(ctx.zone.id);
  const storageLabel =
    !cfg || cfg.kind === "builtin"
      ? "Digital Twin database"
      : cfg.kind === "s3"
        ? `Your bucket (${cfg.displayTarget})`
        : cfg.kind === "local"
          ? `Folder on this server (${cfg.displayTarget})`
          : `Your API (${cfg.displayTarget})`;

  let error: string | null = null;
  const files = await Promise.all(
    TWIN_FILES.map(async (name) => {
      try {
        const [content, history] = await Promise.all([
          readTwinFile(storage, person, name),
          name === "ABOUT.md" || name === "PROGRESS.md" ? listHistory(storage, person, name) : Promise.resolve([]),
        ]);
        return { name, ...FILE_INFO[name], content, history };
      } catch (err) {
        error = (err as Error).message;
        return { name, ...FILE_INFO[name], content: null, history: [] };
      }
    }),
  );

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          Couldn&apos;t read from file storage: {error}
        </div>
      )}
      <TwinFiles
        files={files}
        canEditAbout={isSelf || ctx.canManage}
        saveAbout={saveAbout.bind(null, ctx.zone.slug, person.id)}
        readVersion={readVersion.bind(null, ctx.zone.slug, person.id)}
        restoreVersion={restoreVersion.bind(null, ctx.zone.slug, person.id)}
        storageLabel={storageLabel}
      />
    </>
  );
}

async function UsageTab({ person, first }: { person: Person; first: string }) {
  const { series, totals, activeDays } = await getPersonDaily(person.id, 30);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Spend, 30 days" value={money(totals.cost)} />
        <StatTile label="Active days" value={`${activeDays} / 30`} />
        <StatTile label="Messages" value={num(totals.messages)} hint="Chat and Cowork" />
        <StatTile label="Claude Code" value={`${num(totals.sessions)} sessions`} hint={`${num(totals.commits)} commits · ${num(totals.prs)} PRs · ${num(totals.lines)} lines`} />
      </div>
      <Card className="mt-5">
        <CardHeader title={`${first === "your" ? "Your" : `${first}'s`} daily spend`} description="Exact values are also in USAGE.md" />
        <div className="px-5 py-4">
          <SpendChart data={series} height={240} />
        </div>
      </Card>
    </>
  );
}

const SOURCE_ICON = { checkin: PenLine, claude: Activity, system: AlertTriangle, github: Activity } as const;

async function ActivityTab({ ctx, person, isSelf }: { ctx: Ctx; person: Person; isSelf: boolean }) {
  const events = await getPersonEvents(person.id, 80);
  const hideCheckins = !ctx.zone.includeCheckins && !isSelf;
  return (
    <Card>
      <CardHeader title="Activity" description="Raw events behind PROGRESS.md: check-ins, daily Claude activity and system events." />
      <ul className="divide-y divide-border">
        {events.map((e) => {
          const Icon = SOURCE_ICON[e.source] ?? MessageSquareText;
          return (
            <li key={e.id} className="flex gap-3 px-5 py-3">
              <Icon size={16} className={cn("mt-0.5 shrink-0", e.source === "system" ? "text-warn" : e.source === "checkin" ? "text-accent" : "text-text-3")} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13px] font-medium capitalize">{e.source === "claude" ? "Claude activity" : e.source === "checkin" ? "Check-in" : e.type.replace(/_/g, " ")}</span>
                  <span className="text-xs text-text-3">{e.occurredAt.toISOString().slice(0, 10)}</span>
                  {!e.processedAt && <Badge tone="accent">new</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-text-2">{e.source === "checkin" && hideCheckins ? "(check-in text hidden by zone privacy settings)" : e.summary}</p>
              </div>
            </li>
          );
        })}
        {!events.length && <li className="px-5 py-10 text-center text-sm text-text-3">No events yet.</li>}
      </ul>
    </Card>
  );
}

function ManageTab({ slug, person }: { slug: string; person: Person }) {
  return (
    <Card className="max-w-2xl">
      <CardHeader title="Person settings" description="Labels used across the dashboard and in the twin's context." />
      <div className="px-5 py-5">
        <ActionForm action={updatePerson.bind(null, slug, person.id)} submitLabel="Save">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input name="name" defaultValue={person.name ?? ""} /></Field>
            <Field label="Team"><Input name="team" defaultValue={person.team ?? ""} /></Field>
            <Field label="Title"><Input name="title" defaultValue={person.title ?? ""} /></Field>
            <Field label="Seat"><Input name="seat" defaultValue={person.seat ?? ""} placeholder="Enterprise (premium)" /></Field>
            <Field label="Status" hint="Removed people stay in history but leave the active list">
              <Select name="status" defaultValue={person.status}>
                <option value="active">Active</option>
                <option value="removed">Removed</option>
              </Select>
            </Field>
          </div>
        </ActionForm>
      </div>
    </Card>
  );
}
