import { NextResponse } from "next/server";
import { expectedSession } from "@/lib/shareAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = expectedSession();
  if (!expected) {
    // Gate disabled — nothing to log into.
    return NextResponse.json({ ok: true, gated: false });
  }

  let user = "";
  let password = "";
  try {
    const body = await req.json();
    user = (body.user ?? "").toString();
    password = (body.password ?? "").toString();
  } catch {
    // ignore malformed body
  }

  const configuredUser = process.env.SHARE_USER?.trim() ?? "";
  const provided = Buffer.from(`${user.trim()}:${password}`).toString("base64");
  const userOk = configuredUser ? user.trim() === configuredUser : true;

  if (userOk && provided === expected) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("share_session", expected, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }

  return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
}
