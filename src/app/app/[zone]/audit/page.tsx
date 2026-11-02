import Link from "next/link";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireManager } from "@/lib/access";
import { getAudit } from "@/lib/queries";

export const metadata = { title: "Audit log" };

const tone = (action: string) =>
  action === "usage spike" ? "warn" : action === "asked twin" ? "accent" : action.includes("removed") ? "danger" : "neutral";

export default async function Audit({ params }: { params: Promise<{ zone: string }> }) {
  const { zone: slug } = await params;
  const ctx = await requireManager(slug);
  const rows = await getAudit(ctx.zone.id, { limit: 300 });
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of system events, admin changes, and every question asked to a twin. Each person sees their own entries in their AUDIT_LOG.md."
      />
      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>Time (UTC)</Th>
              <Th>Event</Th>
              <Th>Person</Th>
              <Th>By</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-text-2 tabular">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</Td>
                <Td><Badge tone={tone(r.action)}>{r.action}</Badge></Td>
                <Td className="whitespace-nowrap">
                  {r.personId ? <Link href={`/app/${slug}/people/${r.personId}`} className="hover:underline">{r.personName ?? r.personEmail}</Link> : <span className="text-text-3">—</span>}
                </Td>
                <Td className="whitespace-nowrap text-text-2">{r.actor.replace(/^user:/, "")}</Td>
                <Td className="max-w-md text-text-2">{r.detail}</Td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-text-3">No events yet.</td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
