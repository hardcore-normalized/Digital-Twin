import { ActionForm } from "@/components/action-form";
import { Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { requireManager } from "@/lib/access";
import { deleteZone, updateZone } from "@/lib/actions";

export const metadata = { title: "Settings" };

export default async function GeneralSettings({ params }: { params: Promise<{ zone: string }> }) {
  const { zone: slug } = await params;
  const ctx = await requireManager(slug);
  return (
    <>
      <PageHeader title="General" description="Your zone is the shared space for one company." />
      <div className="max-w-2xl space-y-5">
        <Card>
          <CardHeader title="Zone" />
          <div className="px-5 py-5">
            <ActionForm action={updateZone.bind(null, slug)} submitLabel="Save">
              <Field label="Company name"><Input name="name" defaultValue={ctx.zone.name} required /></Field>
              <Field label="Zone URL"><Input value={`/app/${ctx.zone.slug}`} readOnly className="text-text-3" /></Field>
            </ActionForm>
          </div>
        </Card>
        {ctx.role === "owner" && (
          <Card>
            <CardHeader title="Delete zone" description="Deletes all people, usage data, twins stored in Digital Twin, and chat history. Files in your own bucket or API are not touched." />
            <div className="px-5 py-5">
              <ActionForm action={deleteZone.bind(null, slug)} submitLabel="Delete zone permanently" submitVariant="danger" pendingLabel="Deleting…">
                <Field label={`Type "${ctx.zone.slug}" to confirm`}><Input name="confirm" autoComplete="off" /></Field>
              </ActionForm>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
