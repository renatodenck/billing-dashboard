import { brDay } from "./format";

const ENDPOINT = "https://api.anthropic.com/v1/organizations/cost_report";

type CostBucket = {
  starting_at: string;
  ending_at: string;
  results: Array<{
    currency?: string;
    amount?: string | number;
    workspace_id?: string | null;
  }>;
};

type CostsResponse = {
  data: CostBucket[];
  has_more: boolean;
  next_page?: string | null;
};

export type AnthropicUsage = {
  currency: string;
  totalSpent: number;
  spentToday: number;
  spentMonth: number;
  daily: Array<{ day: string; amount: number }>;
};

function startOfMonthBR(): string {
  const today = brDay();
  return `${today.slice(0, 7)}-01`;
}

export async function fetchAnthropicUsage(adminKey: string, days = 60): Promise<AnthropicUsage> {
  const now = new Date();
  const startingAt = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const endingAt = now.toISOString();

  const buckets: CostBucket[] = [];
  let nextPage: string | null = null;

  do {
    const params = new URLSearchParams({
      starting_at: startingAt,
      ending_at: endingAt,
      bucket_width: "1d",
      limit: "31",
    });
    if (nextPage) params.set("page", nextPage);

    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: {
        "x-api-key": adminKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic Cost API ${res.status}: ${text}`);
    }

    const json = (await res.json()) as CostsResponse;
    buckets.push(...json.data);
    nextPage = json.has_more ? json.next_page ?? null : null;
  } while (nextPage);

  let currency = "USD";
  const byDay = new Map<string, number>();

  for (const b of buckets) {
    const day = brDay(b.starting_at);
    let amount = byDay.get(day) ?? 0;
    for (const r of b.results) {
      const raw = r.amount;
      const v = typeof raw === "string" ? parseFloat(raw) : typeof raw === "number" ? raw : 0;
      if (Number.isFinite(v)) amount += v;
      if (r.currency) currency = r.currency.toUpperCase();
    }
    byDay.set(day, amount);
  }

  const daily = Array.from(byDay.entries())
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  const today = brDay();
  const monthStart = startOfMonthBR();
  const spentToday = daily.find((d) => d.day === today)?.amount ?? 0;
  const spentMonth = daily.filter((d) => d.day >= monthStart).reduce((s, d) => s + d.amount, 0);
  const totalSpent = daily.reduce((s, d) => s + d.amount, 0);

  return { currency, totalSpent, spentToday, spentMonth, daily };
}
