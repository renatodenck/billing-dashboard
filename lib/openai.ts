type CostBucket = {
  start_time: number;
  end_time: number;
  results: Array<{
    amount: { value: number; currency: string };
    line_item?: string | null;
    project_id?: string | null;
  }>;
};

type CostsResponse = {
  data: CostBucket[];
  has_more: boolean;
  next_page?: string | null;
};

const ENDPOINT = "https://api.openai.com/v1/organization/costs";

export type OpenAIUsage = {
  currency: string;
  totalSpent: number;
  spentToday: number;
  spentMonth: number;
  daily: Array<{ day: string; amount: number }>;
};

function dayKey(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

function startOfTodayUtc(): number {
  const now = new Date();
  const d = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor(d / 1000);
}

function startOfMonthUtc(): number {
  const now = new Date();
  const d = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  return Math.floor(d / 1000);
}

export async function fetchOpenAIUsage(adminKey: string, days = 60): Promise<OpenAIUsage> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 24 * 60 * 60;

  const buckets: CostBucket[] = [];
  let nextPage: string | null = null;

  do {
    const params = new URLSearchParams({
      start_time: String(start),
      end_time: String(end),
      bucket_width: "1d",
      limit: "180",
    });
    if (nextPage) params.set("page", nextPage);

    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI Costs API ${res.status}: ${text}`);
    }

    const json = (await res.json()) as CostsResponse;
    buckets.push(...json.data);
    nextPage = json.has_more ? json.next_page ?? null : null;
  } while (nextPage);

  let currency = "USD";
  const daily: Array<{ day: string; amount: number }> = [];
  let totalSpent = 0;

  for (const b of buckets) {
    const day = dayKey(b.start_time);
    let amount = 0;
    for (const r of b.results) {
      amount += r.amount.value;
      if (r.amount.currency) currency = r.amount.currency.toUpperCase();
    }
    daily.push({ day, amount });
    totalSpent += amount;
  }

  daily.sort((a, b) => (a.day < b.day ? -1 : 1));

  const todayKey = dayKey(startOfTodayUtc());
  const monthStartKey = dayKey(startOfMonthUtc());

  const spentToday = daily.find((d) => d.day === todayKey)?.amount ?? 0;
  const spentMonth = daily
    .filter((d) => d.day >= monthStartKey)
    .reduce((sum, d) => sum + d.amount, 0);

  return {
    currency,
    totalSpent,
    spentToday,
    spentMonth,
    daily,
  };
}
