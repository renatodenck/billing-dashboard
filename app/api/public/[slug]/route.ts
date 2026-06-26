import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAccount } from "@/lib/metaAccounts";
import { fetchTemplateAnalytics, fetchTemplateById } from "@/lib/metaTemplates";
import { fetchDealsFunnel } from "@/lib/hubspotDeals";
import { fetchClarityInsights } from "@/lib/clarity";
import { getSharedTemplate } from "@/lib/sharedTemplates";
import { expectedSession } from "@/lib/shareAuth";

export const dynamic = "force-dynamic";

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
  const expected = expectedSession();
  if (expected) {
    const session = (await cookies()).get("share_session")?.value;
    if (session !== expected) {
      return NextResponse.json({ error: "Acesso restrito." }, { status: 401 });
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

    // Optional landing-page analytics (Microsoft Clarity). Fails soft.
    let page = null;
    let pageError: string | null = null;
    const clarityToken = process.env.CLARITY_API_TOKEN?.trim();
    if (shared.clarityProjectId && clarityToken) {
      try {
        page = await fetchClarityInsights(clarityToken);
      } catch (err) {
        pageError = err instanceof Error ? err.message : String(err);
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
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
