import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PersonView, type PersonTab } from "@/components/person-view";
import { requireZone } from "@/lib/access";

export const metadata = { title: "My twin" };

const TABS: PersonTab[] = ["chat", "files", "usage", "activity"];

export default async function Me({ params, searchParams }: { params: Promise<{ zone: string }>; searchParams: Promise<{ tab?: string; thread?: string }> }) {
  const { zone: slug } = await params;
  const sp = await searchParams;
  const ctx = await requireZone(slug);
  if (!ctx.self) {
    return (
      <>
        <PageHeader title="My twin" />
        <Card>
          <EmptyState title="You're not tracked in this zone">
            Twins are created for people who appear in the zone&apos;s AI usage data. Your account ({ctx.user.email}) doesn&apos;t match anyone yet.
          </EmptyState>
        </Card>
      </>
    );
  }
  const tab = (TABS.includes(sp.tab as PersonTab) ? sp.tab : "chat") as PersonTab;
  return <PersonView ctx={{ ...ctx, canManage: false }} person={ctx.self} tab={tab} threadId={sp.thread ?? null} basePath={`/app/${slug}/me`} />;
}
