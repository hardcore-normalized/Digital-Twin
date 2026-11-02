import { Sidebar } from "@/components/sidebar";
import { listUserZones, requireZone } from "@/lib/access";

export default async function ZoneLayout({ children, params }: { children: React.ReactNode; params: Promise<{ zone: string }> }) {
  const { zone: slug } = await params;
  const ctx = await requireZone(slug);
  const zones = await listUserZones(ctx.user.id);
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar
        zone={{ slug: ctx.zone.slug, name: ctx.zone.name, role: ctx.role }}
        zones={zones.map((z) => ({ slug: z.slug, name: z.name, role: z.role }))}
        canManage={ctx.canManage}
        hasSelf={Boolean(ctx.self)}
        user={{ name: ctx.user.name, email: ctx.user.email }}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
