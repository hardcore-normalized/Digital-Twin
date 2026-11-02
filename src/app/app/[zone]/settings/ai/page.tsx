import { AiForm } from "@/components/ai-form";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/access";
import { resetAiModel, saveAiSettings } from "@/lib/actions";
import { aiSource, describeAi } from "@/lib/ai";
import { localEndpointsAllowed } from "@/lib/ai/endpoints";

export const metadata = { title: "AI & privacy" };

export default async function AiSettings({ params }: { params: Promise<{ zone: string }> }) {
  const { zone: slug } = await params;
  const ctx = await requireManager(slug);
  const z = ctx.zone;
  const source = aiSource(z);
  const label = describeAi(z);
  return (
    <>
      <PageHeader
        title="AI & privacy"
        description="Twins use an AI model to answer questions and keep PROGRESS.md up to date. Bring your own: Claude, another provider, or a local model."
      />
      <div className="max-w-3xl space-y-5">
        <Card>
          <CardHeader
            title="AI model"
            description={label ?? "Not set up yet"}
            action={<Badge tone={source ? "ok" : "warn"}>{source === "zone" ? "Your key" : source === "server" ? "Server key" : "Not set"}</Badge>}
          />
          <div className="space-y-4 px-5 py-5">
            {!source && <Notice tone="warn">Without a model, twin chat is off and PROGRESS.md uses a plain summary. Everything else works.</Notice>}
            <AiForm
              action={saveAiSettings.bind(null, slug)}
              current={{ preset: z.aiProvider, baseUrl: z.aiBaseUrl, model: z.aiModel, hasKey: Boolean(z.aiKeyEnc), includeCheckins: z.includeCheckins }}
              localAllowed={localEndpointsAllowed()}
              serverKeyAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
            />
            {(z.aiKeyEnc || z.aiProvider !== "anthropic") && (
              <form action={resetAiModel.bind(null, slug)} className="border-t border-border pt-4">
                <button className="text-[13px] text-text-3 hover:text-danger">Remove this AI model and its key</button>
              </form>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="What twins can see" />
          <ul className="list-disc space-y-1.5 py-5 pr-5 pl-10 text-sm text-text-2">
            <li>ABOUT.md (written by the person), PROGRESS.md, USAGE.md and AUDIT_LOG.md.</li>
            <li>Exact usage numbers through tools, and company-wide comparisons for context.</li>
            <li>Never the content of anyone&apos;s AI conversations — Digital Twin doesn&apos;t receive it.</li>
            <li>Every question is logged to the person&apos;s AUDIT_LOG.md, which they can read.</li>
            <li>Whatever model you choose receives these files when it answers. With a local model, nothing leaves your machine.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
