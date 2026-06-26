import { NextResponse } from "next/server";
import { fetchTemplateAnalytics, resolveToken, resolveWabaId } from "@/lib/metaTemplates";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const token = resolveToken();
  const wabaId = resolveWabaId();

  if (!token || !wabaId) {
    return NextResponse.json(
      { error: "META_ACCESS_TOKEN ou META_WABA_ID/META_AD_ACCOUNT_ID não configurados." },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get("templateId")?.trim();
  const since = searchParams.get("since")?.trim();
  const until = searchParams.get("until")?.trim();

  if (!templateId) {
    return NextResponse.json({ error: "Parâmetro templateId obrigatório." }, { status: 400 });
  }
  if (!since || !until || !DATE_RE.test(since) || !DATE_RE.test(until)) {
    return NextResponse.json(
      { error: "Parâmetros since/until obrigatórios no formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  try {
    const analytics = await fetchTemplateAnalytics(token, wabaId, templateId, since, until);
    return NextResponse.json(analytics, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
