import { z } from "zod";
import { canViewPerson, zoneForApi } from "@/lib/access";
import { getDb } from "@/lib/db";
import { getPerson } from "@/lib/queries";
import { getStorage } from "@/lib/storage";
import { streamTwinChat } from "@/lib/twin/chat";

export const maxDuration = 300;

const Body = z.object({ message: z.string().trim().min(1).max(4000), threadId: z.string().nullable().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ zoneId: string; personId: string }> }) {
  const { zoneId, personId } = await params;
  const ctx = await zoneForApi(zoneId);
  if (!ctx) return Response.json({ error: "Not signed in or no access" }, { status: 401 });
  if (!canViewPerson(ctx, personId)) return Response.json({ error: "You can't view this twin" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Message is required" }, { status: 400 });

  const person = await getPerson(ctx.zone.id, personId);
  if (!person) return Response.json({ error: "Person not found" }, { status: 404 });

  const db = await getDb();
  const storage = await getStorage(db, ctx.zone.id);
  const stream = streamTwinChat({ db, storage, ctx, person, threadId: parsed.data.threadId ?? null, message: parsed.data.message });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
