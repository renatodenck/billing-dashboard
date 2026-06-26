import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pageClicks } from "@/db/schema";
import { getSharedTemplate } from "@/lib/sharedTemplates";
import { expectedSession, isShareKeyValid } from "@/lib/shareAuth";

export const dynamic = "force-dynamic";

const GX = 50; // grid cells across width
const GY = 200; // grid cells down height (page is tall)

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getSharedTemplate(slug)) {
    return NextResponse.json({ error: "Painel não encontrado." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);

  // Same gate as the rest of the share page (embed token bypasses it).
  const expected = expectedSession();
  if (expected && !isShareKeyValid(searchParams.get("key"))) {
    const session = (await cookies()).get("share_session")?.value;
    if (session !== expected) {
      return NextResponse.json({ error: "Acesso restrito." }, { status: 401 });
    }
  }

  const device = searchParams.get("device") === "mobile" ? "mobile" : "desktop";

  const rows = await db
    .select({ x: pageClicks.xRatio, y: pageClicks.yRatio })
    .from(pageClicks)
    .where(and(eq(pageClicks.slug, slug), eq(pageClicks.device, device)));

  // Bin into a grid to keep the payload bounded and the render smooth.
  const bins = new Map<string, number>();
  let max = 0;
  for (const r of rows) {
    const x = Number(r.x);
    const y = Number(r.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const gx = Math.min(GX - 1, Math.max(0, Math.floor(x * GX)));
    const gy = Math.min(GY - 1, Math.max(0, Math.floor(y * GY)));
    const key = `${gx},${gy}`;
    const v = (bins.get(key) ?? 0) + 1;
    bins.set(key, v);
    if (v > max) max = v;
  }

  const points = Array.from(bins.entries()).map(([key, w]) => {
    const [gx, gy] = key.split(",").map(Number);
    return { x: (gx + 0.5) / GX, y: (gy + 0.5) / GY, w };
  });

  return NextResponse.json(
    { device, total: rows.length, max, points },
    { headers: { "Cache-Control": "no-store" } }
  );
}
