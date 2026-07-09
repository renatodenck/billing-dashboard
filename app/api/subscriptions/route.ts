import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { isTeam } from "@/lib/teams";

export const dynamic = "force-dynamic";

export type SubscriptionDTO = {
  id: number;
  tool: string;
  team: string | null;
  costPerSeat: number;
  seats: number;
  currency: string;
  billingDay: number | null;
  notes: string | null;
  monthly: number;
};

type ParsedBody = {
  tool: string;
  team: string | null;
  costPerSeat: number;
  seats: number;
  currency: string;
  billingDay: number | null;
  notes: string | null;
};

// Valida o corpo. Em modo parcial (PATCH) só valida os campos presentes.
export function parseBody(
  body: unknown,
  partial = false
): ParsedBody | Partial<ParsedBody> | { error: string } {
  if (!body || typeof body !== "object") return { error: "Corpo inválido." };
  const b = body as Record<string, unknown>;
  const out: Partial<ParsedBody> = {};

  const has = (k: string) => b[k] !== undefined && b[k] !== null;

  if (has("tool") || !partial) {
    const tool = typeof b.tool === "string" ? b.tool.trim() : "";
    if (!tool) return { error: "Informe o nome da ferramenta." };
    out.tool = tool;
  }
  if (has("costPerSeat") || !partial) {
    const n = Number(b.costPerSeat);
    if (!Number.isFinite(n) || n < 0) return { error: "Custo por assento inválido." };
    out.costPerSeat = n;
  }
  if (has("seats") || !partial) {
    const n = Math.trunc(Number(b.seats));
    if (!Number.isFinite(n) || n < 1) return { error: "Nº de assentos deve ser ≥ 1." };
    out.seats = n;
  }
  if (has("currency") || !partial) {
    const c = typeof b.currency === "string" ? b.currency.trim().toUpperCase() : "USD";
    out.currency = c || "USD";
  }
  if (has("notes")) {
    out.notes = typeof b.notes === "string" ? b.notes.trim() || null : null;
  } else if (!partial) {
    out.notes = null;
  }
  if (has("team")) {
    out.team = isTeam(b.team) ? b.team : null;
  } else if (!partial) {
    out.team = null;
  }
  if (has("billingDay")) {
    const n = Math.trunc(Number(b.billingDay));
    out.billingDay = Number.isFinite(n) && n >= 1 && n <= 31 ? n : null;
  } else if (!partial) {
    out.billingDay = null;
  }

  return out;
}

export async function GET() {
  const rows = await db.select().from(subscriptions).orderBy(asc(subscriptions.tool));
  const dtos: SubscriptionDTO[] = rows.map((r) => {
    const costPerSeat = Number(r.costPerSeat);
    return {
      id: r.id,
      tool: r.tool,
      team: r.team,
      costPerSeat,
      seats: r.seats,
      currency: r.currency,
      billingDay: r.billingDay,
      notes: r.notes,
      monthly: costPerSeat * r.seats,
    };
  });
  return NextResponse.json(dtos, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = parseBody(body, false);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const p = parsed as ParsedBody;
  const [row] = await db
    .insert(subscriptions)
    .values({
      tool: p.tool,
      team: p.team,
      costPerSeat: p.costPerSeat.toFixed(4),
      seats: p.seats,
      currency: p.currency,
      billingDay: p.billingDay,
      notes: p.notes,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
