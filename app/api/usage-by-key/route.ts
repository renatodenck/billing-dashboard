import { NextResponse } from "next/server";
import { fetchAnthropicUsageByKey } from "@/lib/anthropicUsage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = process.env.ANTHROPIC_ADMIN_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "ANTHROPIC_ADMIN_KEY não configurada." }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const now = Date.now();
  const startingAt = since ? `${since}T00:00:00Z` : new Date(now - 30 * 864e5).toISOString();
  const endingAt = until ? `${until}T23:59:59Z` : new Date(now).toISOString();

  try {
    const data = await fetchAnthropicUsageByKey(key, startingAt, endingAt);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
