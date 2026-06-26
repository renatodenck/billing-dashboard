import { NextResponse } from "next/server";
import { getAccount } from "@/lib/metaAccounts";
import { listTemplates } from "@/lib/metaTemplates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const account = getAccount(searchParams.get("account"));

  if (!account) {
    return NextResponse.json(
      { error: "Nenhuma conta Meta configurada (token + WABA ID)." },
      { status: 400 }
    );
  }

  try {
    const templates = await listTemplates(account.token, account.wabaId);
    return NextResponse.json(
      { account: account.key, templates },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
