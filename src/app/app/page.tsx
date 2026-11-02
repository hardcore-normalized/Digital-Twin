import { redirect } from "next/navigation";
import { claimAccess, listUserZones, requireUser } from "@/lib/access";

export default async function AppEntry({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const user = await requireUser();
  await claimAccess(user);
  const zones = await listUserZones(user.id);
  const { demo } = await searchParams;
  if (!zones.length) redirect(demo ? "/app/new?demo=1" : "/app/new");
  const z = zones[0];
  redirect(z.role === "member" ? `/app/${z.slug}/me` : `/app/${z.slug}`);
}
