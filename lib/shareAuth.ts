/**
 * Password gate for public share pages. The gate is ACTIVE only when
 * SHARE_PASSWORD is configured; otherwise share pages stay open.
 * The session cookie stores base64("<user>:<password>"), compared server-side.
 */
export function expectedSession(): string | null {
  const password = process.env.SHARE_PASSWORD?.trim();
  if (!password) return null;
  const user = process.env.SHARE_USER?.trim() ?? "";
  return Buffer.from(`${user}:${password}`).toString("base64");
}

export function shareUser(): string {
  return process.env.SHARE_USER?.trim() ?? "";
}
