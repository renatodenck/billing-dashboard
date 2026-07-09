import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { parseBody } from "../route";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(body, true);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const set: Record<string, unknown> = { updatedAt: sql`now()` };
  if (parsed.tool !== undefined) set.tool = parsed.tool;
  if (parsed.team !== undefined) set.team = parsed.team;
  if (parsed.billingDay !== undefined) set.billingDay = parsed.billingDay;
  if (parsed.costPerSeat !== undefined) set.costPerSeat = parsed.costPerSeat.toFixed(4);
  if (parsed.seats !== undefined) set.seats = parsed.seats;
  if (parsed.currency !== undefined) set.currency = parsed.currency;
  if (parsed.notes !== undefined) set.notes = parsed.notes;

  const [row] = await db
    .update(subscriptions)
    .set(set)
    .where(eq(subscriptions.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Assinatura não encontrada." }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  return new NextResponse(null, { status: 204 });
}
