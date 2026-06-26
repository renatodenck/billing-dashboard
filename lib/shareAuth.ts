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

/**
 * Embed bypass: a secret key (SHARE_EMBED_KEY) passed as ?key= lets an iframe
 * skip the cookie login — needed because third-party cookies don't work in a
 * cross-site iframe. The direct link (no key) still uses the login.
 */
export function isShareKeyValid(key: string | null | undefined): boolean {
  const expected = process.env.SHARE_EMBED_KEY?.trim();
  return !!expected && !!key && key === expected;
}
