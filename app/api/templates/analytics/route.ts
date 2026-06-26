import { NextResponse } from "next/server";
import { getAccount } from "@/lib/metaAccounts";
import { fetchTemplateAnalytics } from "@/lib/metaTemplates";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const account = getAccount(searchParams.get("account"));

  if (!account) {
    return NextResponse.json(
      { error: "Nenhuma conta Meta configurada (token + WABA ID)." },
      { status: 400 }
    );
  }

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
    const analytics = await fetchTemplateAnalytics(
      account.token,
      account.wabaId,
      templateId,
      since,
      until
    );
    return NextResponse.json(analytics, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
