import { brDay } from "./format";

const GRAPH = "https://graph.facebook.com/v22.0";

export type MetaUsage = {
  currency: string;
  totalSpent: number;
  balance: number | null;
  spentToday: number;
  spentMonth: number;
  daily: Array<{ day: string; amount: number }>;
  accountName: string;
};

type WabaInfo = {
  name: string;
  currency: string;
};

type PricingDataPoint = {
  start: number;
  end: number;
  volume: number;
  cost: number;
};

type PricingResponse = {
  data: Array<{
    data_points: PricingDataPoint[];
  }>;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    const safeUrl = url.replace(/access_token=[^&]+/, "access_token=<redacted>");
    throw new Error(`Meta API ${res.status} at ${safeUrl}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function fetchMetaUsage(
  accessToken: string,
  wabaId: string,
  days = 60
): Promise<MetaUsage> {
  const id = wabaId.trim();
  const tokenParam = encodeURIComponent(accessToken);

  // Account-level info (name + currency)
  const accountUrl = `${GRAPH}/${id}?fields=name,currency&access_token=${tokenParam}`;
  const account = await fetchJson<WabaInfo>(accountUrl);

  // Pricing analytics in unix seconds. Window must be ≤ 90 days.
  const now = Math.floor(Date.now() / 1000);
  const since = now - days * 24 * 60 * 60;

  const pricingUrl = `${GRAPH}/${id}/pricing_analytics?start=${since}&end=${now}&granularity=DAILY&access_token=${tokenParam}`;
  const pricing = await fetchJson<PricingResponse>(pricingUrl);

  const points = pricing.data?.[0]?.data_points ?? [];

  // Bucket by BRT day. Each data point represents 24h starting at p.start.
  const byDay = new Map<string, number>();
  for (const p of points) {
    const day = brDay(p.start * 1000);
    byDay.set(day, (byDay.get(day) ?? 0) + (Number(p.cost) || 0));
  }

  const daily = Array.from(byDay.entries())
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  const today = brDay();
  const monthStart = `${today.slice(0, 7)}-01`;
  const spentToday = daily.find((d) => d.day === today)?.amount ?? 0;
  const spentMonth = daily.filter((d) => d.day >= monthStart).reduce((s, d) => s + d.amount, 0);
  const totalSpent = daily.reduce((s, d) => s + d.amount, 0);

  return {
    currency: (account.currency || "USD").toUpperCase(),
    accountName: account.name,
    totalSpent,
    balance: null,
    spentToday,
    spentMonth,
    daily,
  };
}


