import { NextResponse } from "next/server";
import { accountOptions } from "@/lib/metaAccounts";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { accounts: accountOptions() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
