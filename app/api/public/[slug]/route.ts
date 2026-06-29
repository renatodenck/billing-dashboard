import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { kvCache } from "@/db/schema";
import { getAccount } from "@/lib/metaAccounts";
import { fetchTemplateAnalytics, fetchTemplateById } from "@/lib/metaTemplates";
import { fetchDealsFunnel } from "@/lib/hubspotDeals";
import { fetchClarityInsights, type ClarityInsights } from "@/lib/clarity";
import { getSharedTemplate } from "@/lib/sharedTemplates";
import { expectedSession, isShareKeyValid } from "@/lib/shareAuth";

export const dynamic = "force-dynamic";

// Clarity's Data Export API allows only ~10 calls/day per project, so cache
// the result and refresh at most every few hours; serve stale on failure.
const CLARITY_TTL_MS = 3 * 60 * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_PRESETS = new Set(["7d", "30d", "60d"]);

function rangeFromPreset(preset: string): { since: string; until: string } {
  const dayMs = 24 * 60 * 60 * 1000;
  const brOffset = 3 * 60 * 60 * 1000;
  const today = new Date(Date.now() - brOffset).toISOString().slice(0, 10);
  const days = preset === "30d" ? 30 : preset === "60d" ? 60 : 7;
  const since = new Date(Date.now() - brOffset - (days - 1) * dayMs).toISOString().slice(0, 10);
  return { since, until: today };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const shared = getSharedTemplate(slug);
  if (!shared) {
    return NextResponse.json({ error: "Painel não encontrado." }, { status: 404 });
  }

  // Optional password gate (only active when SHARE_PASSWORD is configured).
  // An iframe can bypass it with a valid ?key= (embed token).
  const expected = expectedSession();
  if (expected) {
    const { searchParams } = new URL(req.url);
    if (!isShareKeyValid(searchParams.get("key"))) {
      const session = (await cookies()).get("share_session")?.value;
      if (session !== expected) {
        return NextResponse.json({ error: "Acesso restrito." }, { status: 401 });
      }
    }
  }

  const account = getAccount(shared.accountKey);
  if (!account) {
    return NextResponse.json({ error: "Conta não configurada." }, { status: 400 });
  }

  // Range is the only viewer-controllable input, and it's clamped to presets.
  const { searchParams } = new URL(req.url);
  const preset = searchParams.get("preset") ?? "7d";
  let since = searchParams.get("since")?.trim();
  let until = searchParams.get("until")?.trim();
  if (!since || !until || !DATE_RE.test(since) || !DATE_RE.test(until)) {
    const p = ALLOWED_PRESETS.has(preset) ? preset : "7d";
    ({ since, until } = rangeFromPreset(p));
  }

  // Clarity only serves the last 1–3 days, so it has its own day count.
  const clarityDaysRaw = Number(searchParams.get("clarityDays"));
  const clarityDays =
    clarityDaysRaw === 1 || clarityDaysRaw === 2 || clarityDaysRaw === 3 ? clarityDaysRaw : 3;

  try {
    const [template, analytics] = await Promise.all([
      fetchTemplateById(account.token, shared.templateId),
      fetchTemplateAnalytics(account.token, account.wabaId, shared.templateId, since, until),
    ]);

    // Optional deals funnel (HubSpot). A failure here must not break the page.
    let deals = null;
    let dealsError: string | null = null;
    const hubspotToken = process.env.HUBSPOT_TOKEN?.trim();
    if (shared.deals && hubspotToken) {
      try {
        deals = await fetchDealsFunnel(hubspotToken, shared.deals, since, until);
      } catch (err) {
        dealsError = err instanceof Error ? err.message : String(err);
      }
    }

    // Optional landing-page analytics (Microsoft Clarity), cached. Fails soft.
    let page: ClarityInsights | null = null;
    let pageError: string | null = null;
    const clarityToken = process.env.CLARITY_API_TOKEN?.trim();
    if (shared.clarityProjectId && clarityToken) {
      const cacheKey = `clarity:${shared.clarityProjectId}:${clarityDays}`;
      const [cached] = await db.select().from(kvCache).where(eq(kvCache.key, cacheKey)).limit(1);
      const fresh = cached && Date.now() - new Date(cached.updatedAt).getTime() < CLARITY_TTL_MS;

      if (cached && fresh) {
        page = cached.value as ClarityInsights;
      } else if (cached) {
        // Stale: atomically "claim" the refresh so concurrent requests don't all
        // hit Clarity at once (which would burn the daily quota). Only the request
        // whose conditional UPDATE wins actually fetches; the rest serve stale.
        const staleBefore = new Date(Date.now() - CLARITY_TTL_MS);
        const claimed = await db
          .update(kvCache)
          .set({ updatedAt: new Date() })
          .where(and(eq(kvCache.key, cacheKey), lt(kvCache.updatedAt, staleBefore)))
          .returning({ key: kvCache.key });
        if (claimed.length === 0) {
          page = cached.value as ClarityInsights; // someone else is refreshing
        } else {
          try {
            page = await fetchClarityInsights(clarityToken, clarityDays);
            await db.update(kvCache).set({ value: page, updatedAt: new Date() }).where(eq(kvCache.key, cacheKey));
          } catch {
            page = cached.value as ClarityInsights; // serve stale on rate-limit/error
          }
        }
      } else {
        // Cold start: no cache yet.
        try {
          page = await fetchClarityInsights(clarityToken, clarityDays);
          await db
            .insert(kvCache)
            .values({ key: cacheKey, value: page, updatedAt: new Date() })
            .onConflictDoUpdate({ target: kvCache.key, set: { value: page, updatedAt: new Date() } });
        } catch (err) {
          pageError = err instanceof Error ? err.message : String(err);
        }
      }
    }

    return NextResponse.json(
      {
        title: shared.title,
        subtitle: shared.subtitle,
        template,
        analytics,
        deals,
        dealsError,
        page,
        pageError,
        clarityProjectId: shared.clarityProjectId ?? null,
        usdToBrl: Number(process.env.NEXT_PUBLIC_USD_TO_BRL ?? "5") || 5,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
