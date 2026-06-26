import { NextResponse } from "next/server";
import { db } from "@/db";
import { pageClicks } from "@/db/schema";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Receives click pings from the landing page (cross-origin, via sendBeacon).
// Named neutrally (not "track") to avoid ad/privacy blockers dropping the call.
export async function POST(req: Request) {
  try {
    const text = await req.text();
    const b = JSON.parse(text || "{}");
    const slug = String(b.slug ?? "").slice(0, 64);
    const device = b.device === "mobile" ? "mobile" : "desktop";
    const x = Number(b.x);
    const y = Number(b.y);
    if (slug && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      await db.insert(pageClicks).values({
        slug,
        device,
        xRatio: x.toFixed(5),
        yRatio: y.toFixed(5),
      });
    }
  } catch {
    // swallow — tracking must never error the visitor's page
  }
  return new NextResponse(null, { status: 204, headers: CORS });
}
