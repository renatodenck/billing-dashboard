const GRAPH = "https://graph.facebook.com/v23.0";

export type MetaUsage = {
  currency: string;
  totalSpent: number;
  balance: number | null;
  spentToday: number;
  spentMonth: number;
  daily: Array<{ day: string; amount: number }>;
  accountName: string;
};

type AdAccount = {
  name: string;
  currency: string;
  amount_spent: string;
  balance: string;
};

type Insight = {
  spend: string;
  date_start: string;
  date_stop: string;
};

type InsightsResponse = {
  data: Insight[];
  paging?: { next?: string };
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function daysAgoUtc(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function fetchMetaUsage(
  accessToken: string,
  adAccountId: string,
  days = 60
): Promise<MetaUsage> {
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const accountFields = ["name", "currency", "amount_spent", "balance"].join(",");
  const accountUrl = `${GRAPH}/${actId}?fields=${accountFields}&access_token=${encodeURIComponent(accessToken)}`;
  const account = await fetchJson<AdAccount>(accountUrl);

  const since = daysAgoUtc(days);
  const until = todayUtc();
  const insightsParams = new URLSearchParams({
    fields: "spend",
    time_increment: "1",
    "time_range[since]": since,
    "time_range[until]": until,
    limit: "200",
    access_token: accessToken,
  });

  const insights: Insight[] = [];
  let next: string | undefined = `${GRAPH}/${actId}/insights?${insightsParams.toString()}`;
  while (next) {
    const json: InsightsResponse = await fetchJson<InsightsResponse>(next);
    insights.push(...json.data);
    next = json.paging?.next;
  }

  const daily = insights
    .map((i) => ({ day: i.date_start, amount: parseFloat(i.spend) || 0 }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  const today = todayUtc();
  const monthStart = startOfMonthUtc();
  const spentToday = daily.find((d) => d.day === today)?.amount ?? 0;
  const spentMonth = daily.filter((d) => d.day >= monthStart).reduce((s, d) => s + d.amount, 0);

  const amountSpentMinor = parseFloat(account.amount_spent) || 0;
  const balanceMinor = parseFloat(account.balance) || 0;

  return {
    currency: account.currency,
    accountName: account.name,
    totalSpent: amountSpentMinor / 100,
    balance: balanceMinor / 100,
    spentToday,
    spentMonth,
    daily,
  };
}
