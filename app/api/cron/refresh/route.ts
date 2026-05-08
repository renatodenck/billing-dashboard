import { NextRequest, NextResponse } from "next/server";
import { sql, gt } from "drizzle-orm";
import { db } from "@/db";
import { snapshots, dailySpend } from "@/db/schema";
import { fetchOpenAIUsage } from "@/lib/openai";
import { fetchMetaUsage } from "@/lib/meta";
import { fetchHubSpotLeads } from "@/lib/hubspot";
import { brDay } from "@/lib/format";

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

  // Run all source captures in parallel; total time = max(any single source)
  await Promise.allSettled([
    captureOpenAI(results, errors),
    captureMeta(
      "meta",
      process.env.META_ACCESS_TOKEN?.trim(),
      process.env.META_WABA_ID?.trim() ?? process.env.META_AD_ACCOUNT_ID?.trim(),
      results,
      errors
    ),
    captureMeta(
      "meta_b2b",
      process.env.META_ACCESS_TOKEN_B2B?.trim(),
      process.env.META_WABA_B2B_ID?.trim(),
      results,
      errors
    ),
    captureHubSpot(
      "hubspot_b2c",
      process.env.HUBSPOT_TOKEN?.trim(),
      process.env.HUBSPOT_LEAD_PIPELINE?.trim(),
      process.env.HUBSPOT_LEAD_STAGE?.trim(),
      results,
      errors
    ),
    captureHubSpot(
      "hubspot_b2b",
      process.env.HUBSPOT_TOKEN?.trim(),
      process.env.HUBSPOT_LEAD_PIPELINE_B2B?.trim(),
      process.env.HUBSPOT_LEAD_STAGE_B2B?.trim(),
      results,
      errors
    ),
  ]);

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

async function captureOpenAI(
  results: Record<string, unknown>,
  errors: Record<string, string>
): Promise<void> {
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
      days: openai.daily.length,
    };
  } catch (err) {
    errors.openai = err instanceof Error ? err.message : String(err);
  }
}

async function captureMeta(
  source: string,
  token: string | undefined,
  wabaId: string | undefined,
  results: Record<string, unknown>,
  errors: Record<string, string>
): Promise<void> {
  if (!token || !wabaId) {
    results[source] = { skipped: true, reason: `Token or WABA ID not set for ${source}` };
    return;
  }
  try {
    const meta = await fetchMetaUsage(token, wabaId, 60);
    await db.insert(snapshots).values({
      source,
      currency: meta.currency,
      totalSpent: meta.totalSpent.toFixed(4),
      spentToday: meta.spentToday.toFixed(4),
      spentMonth: meta.spentMonth.toFixed(4),
      balance: meta.balance != null ? meta.balance.toFixed(4) : null,
      raw: { daily: meta.daily, accountName: meta.accountName },
    });
    await upsertDaily(source, meta.currency, meta.daily);
    results[source] = {
      currency: meta.currency,
      totalSpent: meta.totalSpent,
      spentToday: meta.spentToday,
      spentMonth: meta.spentMonth,
      days: meta.daily.length,
      accountName: meta.accountName,
    };
  } catch (err) {
    errors[source] = err instanceof Error ? err.message : String(err);
  }
}

async function captureHubSpot(
  source: string,
  token: string | undefined,
  pipeline: string | undefined,
  stage: string | undefined,
  results: Record<string, unknown>,
  errors: Record<string, string>
): Promise<void> {
  if (!token || !pipeline || !stage) {
    results[source] = {
      skipped: true,
      reason: `Token, pipeline or stage not set for ${source}`,
    };
    return;
  }
  try {
    const hub = await fetchHubSpotLeads(token, pipeline, stage, 90);
    await db.insert(snapshots).values({
      source,
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
    await upsertDaily(source, "LEADS", hub.daily);
    results[source] = {
      totalLeads: hub.totalLeads,
      pipelineName: hub.pipelineName,
      stageName: hub.stageName,
      days: hub.daily.length,
    };
  } catch (err) {
    errors[source] = err instanceof Error ? err.message : String(err);
  }
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
