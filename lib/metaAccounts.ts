// Meta WhatsApp accounts (WABAs) the dashboard can analyze. An account is
// "available" only when both its token and WABA id are configured in env.

type AccountDef = {
  key: string;
  label: string;
  tokenEnv: string;
  /** First env var that resolves wins (supports legacy names). */
  wabaEnvs: string[];
};

const ACCOUNT_DEFS: AccountDef[] = [
  {
    key: "tbs",
    label: "The Best Speaker Brasil",
    tokenEnv: "META_ACCESS_TOKEN",
    wabaEnvs: ["META_WABA_TBS_ID"],
  },
  {
    key: "b2c",
    label: "Bru SDR (B2C)",
    tokenEnv: "META_ACCESS_TOKEN",
    wabaEnvs: ["META_WABA_ID", "META_AD_ACCOUNT_ID"],
  },
  {
    key: "b2b",
    label: "PSA | Manu (B2B)",
    tokenEnv: "META_ACCESS_TOKEN_B2B",
    wabaEnvs: ["META_WABA_B2B_ID"],
  },
];

export type MetaAccount = { key: string; label: string; token: string; wabaId: string };
export type AccountOption = { key: string; label: string };

function resolve(def: AccountDef): MetaAccount | null {
  const token = process.env[def.tokenEnv]?.trim();
  if (!token) return null;
  let wabaId: string | undefined;
  for (const env of def.wabaEnvs) {
    const v = process.env[env]?.trim();
    if (v) {
      wabaId = v;
      break;
    }
  }
  if (!wabaId) return null;
  return { key: def.key, label: def.label, token, wabaId };
}

/** All accounts that are fully configured, in display order. */
export function listAccounts(): MetaAccount[] {
  return ACCOUNT_DEFS.map(resolve).filter((a): a is MetaAccount => a !== null);
}

/** Public-safe options (no secrets) for the account picker. */
export function accountOptions(): AccountOption[] {
  return listAccounts().map(({ key, label }) => ({ key, label }));
}

/**
 * Resolve a specific account by key. When key is omitted/unknown, falls back
 * to the first configured account so existing callers keep working.
 */
export function getAccount(key?: string | null): MetaAccount | null {
  const accounts = listAccounts();
  if (accounts.length === 0) return null;
  if (!key) return accounts[0];
  return accounts.find((a) => a.key === key) ?? accounts[0];
}
