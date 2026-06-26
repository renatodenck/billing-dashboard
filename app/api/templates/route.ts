import { NextResponse } from "next/server";
import { listTemplates, resolveToken, resolveWabaId } from "@/lib/metaTemplates";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = resolveToken();
  const wabaId = resolveWabaId();

  if (!token || !wabaId) {
    return NextResponse.json(
      { error: "META_ACCESS_TOKEN ou META_WABA_ID/META_AD_ACCOUNT_ID não configurados." },
      { status: 400 }
    );
  }

  try {
    const templates = await listTemplates(token, wabaId);
    return NextResponse.json({ templates }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
