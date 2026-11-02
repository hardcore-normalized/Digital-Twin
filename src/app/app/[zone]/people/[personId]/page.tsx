import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PersonView, type PersonTab } from "@/components/person-view";
import { requireManager } from "@/lib/access";
import { getPerson } from "@/lib/queries";

const TABS: PersonTab[] = ["chat", "files", "usage", "activity", "manage"];

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ zone: string; personId: string }>;
  searchParams: Promise<{ tab?: string; thread?: string }>;
}) {
  const { zone: slug, personId } = await params;
  const sp = await searchParams;
  const ctx = await requireManager(slug);
  const person = await getPerson(ctx.zone.id, personId);
  if (!person) notFound();
  const tab = (TABS.includes(sp.tab as PersonTab) ? sp.tab : "chat") as PersonTab;
  return (
    <>
      <Link href={`/app/${slug}/people`} className="mb-4 inline-flex items-center gap-1 text-[13px] text-text-2 hover:text-text">
        <ChevronLeft size={14} /> People
      </Link>
      <PersonView ctx={ctx} person={person} tab={tab} threadId={sp.thread ?? null} basePath={`/app/${slug}/people/${person.id}`} />
    </>
  );
}
