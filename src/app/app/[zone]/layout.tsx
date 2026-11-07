import { Sidebar } from "@/components/sidebar";
import { DownloadButton, StarButton } from "@/components/github-cta";
import { listUserZones, requireZone } from "@/lib/access";
import { getStarCount } from "@/lib/github";
import { isLiveDemo } from "@/lib/site-mode";

export default async function ZoneLayout({ children, params }: { children: React.ReactNode; params: Promise<{ zone: string }> }) {
  const { zone: slug } = await params;
  const ctx = await requireZone(slug);
  const demo = isLiveDemo();
  const [zones, stars] = await Promise.all([listUserZones(ctx.user.id), demo ? getStarCount() : null]);
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar
        zone={{ slug: ctx.zone.slug, name: ctx.zone.name, role: ctx.role }}
        zones={zones.map((z) => ({ slug: z.slug, name: z.name, role: z.role }))}
        canManage={ctx.canManage}
        hasSelf={Boolean(ctx.self)}
        user={{ name: ctx.user.name, email: ctx.user.email }}
        demo={demo}
      />
      <main className="min-w-0 flex-1">
        {demo && (
          <div className="border-b border-border bg-accent-soft">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-[13px] sm:px-8">
              <p className="min-w-64 flex-1 text-text-2">
                <span className="font-medium text-text">Live demo.</span> Acme is a fictional company and this copy is read-only. Download
                Digital Twin to run it with your own data.
              </p>
              <div className="flex gap-2">
                <DownloadButton size="sm" label="Download" />
                <StarButton count={stars} size="sm" label="Star" />
              </div>
            </div>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
