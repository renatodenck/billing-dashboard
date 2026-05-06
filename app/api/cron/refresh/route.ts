import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { snapshots, dailySpend } from "@/db/schema";
import { fetchOpenAIUsage } from "@/lib/openai";
import { fetchMetaUsage } from "@/lib/meta";
import { fetchHubSpotLeads } from "@/lib/hubspot";
import { brDay } from "@/lib/format";
import { gt } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return unauthorized();
  }
  return runRefresh();
}

export async function POST(req: NextRequest) {
  return GET(req);
}

async function runRefresh() {
  const results: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  try {
    const openai = await fetchOpenAIUsage(process.env.OPENAI_ADMIN_KEY!, 60);
    await db.insert(snapshots).values({
      source: "openai",
      currency: openai.currency,
      totalSpent: openai.totalSpent.toFixed(4),
      spentToday: openai.spentToday.toFixed(4),
      spentMonth: openai.spentMonth.toFixed(4),
      raw: { daily: openai.daily },
    });
    await upsertDaily("openai", openai.currency, openai.daily);
    results.openai = {
      currency: openai.currency,
      totalSpent: openai.totalSpent,
      spentToday: openai.spentToday,
      spentMonth: openai.spentMonth,
      days: openai.daily.length,
    };
  } catch (err) {
    errors.openai = err instanceof Error ? err.message : String(err);
  }

  const metaToken = process.env.META_ACCESS_TOKEN?.trim();
  const metaWabaId =
    process.env.META_WABA_ID?.trim() ?? process.env.META_AD_ACCOUNT_ID?.trim();
  if (!metaToken || !metaWabaId) {
    results.meta = { skipped: true, reason: "META_ACCESS_TOKEN or META_WABA_ID not set" };
  } else try {
    const meta = await fetchMetaUsage(metaToken, metaWabaId, 60);
    await db.insert(snapshots).values({
      source: "meta",
      currency: meta.currency,
      totalSpent: meta.totalSpent.toFixed(4),
      spentToday: meta.spentToday.toFixed(4),
      spentMonth: meta.spentMonth.toFixed(4),
      balance: meta.balance != null ? meta.balance.toFixed(4) : null,
      raw: { daily: meta.daily, accountName: meta.accountName },
    });
    await upsertDaily("meta", meta.currency, meta.daily);
    results.meta = {
      currency: meta.currency,
      totalSpent: meta.totalSpent,
      balance: meta.balance,
      spentToday: meta.spentToday,
      spentMonth: meta.spentMonth,
      days: meta.daily.length,
    };
  } catch (err) {
    errors.meta = err instanceof Error ? err.message : String(err);
  }

  const hubspotToken = process.env.HUBSPOT_TOKEN?.trim();
  const hubspotPipeline = process.env.HUBSPOT_LEAD_PIPELINE?.trim();
  const hubspotStage = process.env.HUBSPOT_LEAD_STAGE?.trim();
  if (!hubspotToken || !hubspotPipeline || !hubspotStage) {
    results.hubspot_b2c = {
      skipped: true,
      reason: "HUBSPOT_TOKEN, HUBSPOT_LEAD_PIPELINE or HUBSPOT_LEAD_STAGE not set",
    };
  } else try {
    const hub = await fetchHubSpotLeads(hubspotToken, hubspotPipeline, hubspotStage, 90);
    await db.insert(snapshots).values({
      source: "hubspot_b2c",
      currency: "LEADS",
      totalSpent: hub.totalLeads.toFixed(4),
      raw: {
        daily: hub.daily,
        pipelineName: hub.pipelineName,
        pipelineId: hub.pipelineId,
        stageName: hub.stageName,
        stageId: hub.stageId,
      },
    });
    await upsertDaily("hubspot_b2c", "LEADS", hub.daily);
    results.hubspot_b2c = {
      totalLeads: hub.totalLeads,
      pipelineName: hub.pipelineName,
      stageName: hub.stageName,
      days: hub.daily.length,
    };
  } catch (err) {
    errors.hubspot_b2c = err instanceof Error ? err.message : String(err);
  }

  // Defensive cleanup: remove any future-dated rows (leftovers from when buckets were UTC)
  try {
    const today = brDay();
    await db.delete(dailySpend).where(gt(dailySpend.day, today));
  } catch (err) {
    errors.cleanup = err instanceof Error ? err.message : String(err);
  }

  const status = Object.keys(errors).length === 0 ? 200 : 207;
  return NextResponse.json({ ok: status === 200, results, errors }, { status });
}

async function upsertDaily(
  source: string,
  currency: string,
  daily: Array<{ day: string; amount: number }>
) {
  if (daily.length === 0) return;
  for (const d of daily) {
    await db
      .insert(dailySpend)
      .values({
        source,
        day: d.day,
        currency,
        amount: d.amount.toFixed(4),
      })
      .onConflictDoUpdate({
        target: [dailySpend.source, dailySpend.day],
        set: {
          amount: d.amount.toFixed(4),
          currency,
          updatedAt: sql`now()`,
        },
      });
  }
}
