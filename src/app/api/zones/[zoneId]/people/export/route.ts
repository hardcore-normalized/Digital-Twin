import { zoneForApi } from "@/lib/access";
import { getPeopleTable } from "@/lib/queries";

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(_req: Request, { params }: { params: Promise<{ zoneId: string }> }) {
  const { zoneId } = await params;
  const ctx = await zoneForApi(zoneId);
  if (!ctx?.canManage) return new Response("Forbidden", { status: 403 });
  const rows = await getPeopleTable(ctx.zone.id);
  const header = ["email", "name", "team", "title", "seat", "status", "last_active", "month_to_date_usd", "last_30d_usd", "active_days_30d", "messages_30d", "code_sessions_30d", "lines_added_30d"];
  const lines = rows.map((r) =>
    [r.email, r.name, r.team, r.title, r.seat, r.status, r.lastActiveDate, (r.mtdCents / 100).toFixed(2), (r.cost30 / 100).toFixed(2), r.activeDays30, r.messages30, r.sessions30, r.lines30].map(csv).join(","),
  );
  return new Response([header.join(","), ...lines].join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ctx.zone.slug}-people-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
