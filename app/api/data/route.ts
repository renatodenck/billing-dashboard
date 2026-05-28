import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { snapshots, dailySpend } from "@/db/schema";

export const dynamic = "force-dynamic";

export type DashboardPayload = {
  sources: Record<
    string,
    {
      capturedAt: string | null;
      currency: string | null;
      totalSpent: number | null;
      spentToday: number | null;
      spentMonth: number | null;
      balance: number | null;
      accountName: string | null;
    }
  >;
  daily: Record<string, Array<{ day: string; amount: number }>>;
};

export async function GET() {
  const sources = [
    "openai",
    "anthropic",
    "meta",
    "meta_b2b",
    "hubspot_b2c",
    "hubspot_b2b",
    "hubspot_meetings_b2c",
  ];
  const result: DashboardPayload = { sources: {}, daily: {} };

  for (const source of sources) {
    const [latest] = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.source, source))
      .orderBy(desc(snapshots.capturedAt))
      .limit(1);

    const raw =
      latest?.raw && typeof latest.raw === "object"
        ? (latest.raw as { accountName?: string; pipelineName?: string; stageName?: string })
        : null;
    const accountName =
      raw?.accountName ??
      (raw?.pipelineName && raw?.stageName
        ? `${raw.pipelineName} · ${raw.stageName}`
        : (raw?.pipelineName ?? null));

    result.sources[source] = latest
      ? {
          capturedAt: latest.capturedAt?.toISOString() ?? null,
          currency: latest.currency,
          totalSpent: latest.totalSpent != null ? Number(latest.totalSpent) : null,
          spentToday: latest.spentToday != null ? Number(latest.spentToday) : null,
          spentMonth: latest.spentMonth != null ? Number(latest.spentMonth) : null,
          balance: latest.balance != null ? Number(latest.balance) : null,
          accountName,
        }
      : {
          capturedAt: null,
          currency: null,
          totalSpent: null,
          spentToday: null,
          spentMonth: null,
          balance: null,
          accountName: null,
        };

    const daily = await db
      .select()
      .from(dailySpend)
      .where(eq(dailySpend.source, source))
      .orderBy(dailySpend.day);

    result.daily[source] = daily.map((d) => ({ day: d.day, amount: Number(d.amount) }));
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
