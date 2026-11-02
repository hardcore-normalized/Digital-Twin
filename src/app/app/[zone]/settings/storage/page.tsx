import { ActionButton } from "@/components/action-form";
import { StorageForm } from "@/components/storage-form";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/access";
import { saveStorage, testCurrentStorage } from "@/lib/actions";
import { timeAgo } from "@/lib/format";
import { getStorageConfig } from "@/lib/queries";
import { localEndpointsAllowed } from "@/lib/ai/endpoints";

export const metadata = { title: "File storage" };

const LABEL = { builtin: "Digital Twin database", s3: "Your S3 bucket", http: "Your own API", local: "Folder on this server" } as const;

export default async function StorageSettings({ params }: { params: Promise<{ zone: string }> }) {
  const { zone: slug } = await params;
  const ctx = await requireManager(slug);
  const cfg = await getStorageConfig(ctx.zone.id);
  const kind = cfg?.kind ?? "builtin";
  return (
    <>
      <PageHeader
        title="File storage"
        description="Where each person's twin files (ABOUT.md, PROGRESS.md, USAGE.md, AUDIT_LOG.md and their history) are kept."
      />
      <div className="max-w-4xl space-y-5">
        <Card>
          <CardHeader
            title="Current storage"
            action={<ActionButton action={testCurrentStorage.bind(null, slug)} label="Test connection" pendingLabel="Testing…" size="sm" />}
          />
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
            <span className="font-medium">{LABEL[kind]}</span>
            {cfg?.displayTarget && <code className="font-mono text-xs text-text-2">{cfg.displayTarget}</code>}
            {cfg?.lastTestAt && (
              <Badge tone={cfg.lastTestOk ? "ok" : "danger"}>
                {cfg.lastTestOk ? "Working" : "Failing"} · tested {timeAgo(cfg.lastTestAt)}
              </Badge>
            )}
            {cfg?.lastTestError && <span className="w-full text-xs text-danger">{cfg.lastTestError}</span>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Change storage" description="Usage numbers, events and the audit trail always stay in the Digital Twin database; only the markdown files move." />
          <div className="px-5 py-5">
            <StorageForm current={kind} action={saveStorage.bind(null, slug)} localAllowed={localEndpointsAllowed()} />
          </div>
        </Card>
      </div>
    </>
  );
}
