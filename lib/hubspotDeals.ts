import { brDay } from "./format";
import type { DealsConfig } from "./sharedTemplates";

const API = "https://api.hubapi.com";

export type DealsFunnel = {
  totals: {
    closed: number;
    abandoned: number;
    waiting: number;
    lost: number;
    revenue: number;
  };
  /** closed / (closed + abandoned + waiting) — matches HubSpot "taxa de conclusão". */
  conclusionRate: number | null;
  dailySales: Array<{ day: string; closed: number; abandoned: number; waiting: number }>;
  dailyRevenue: Array<{ day: string; amount: number }>;
};

type DealResult = { id: string; properties: Record<string, string | null> };
type SearchResponse = {
  total: number;
  results: DealResult[];
  paging?: { next?: { after?: string } };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(url: string, init: RequestInit, attempt = 0): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (res.status === 429 && attempt < 5) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1);
    await sleep(waitMs);
    return fetchJson<T>(url, init, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

/**
 * Funnel for one product inside a deal pipeline, over [since, until] (YYYY-MM-DD, BRT).
 * Range is applied to the deal createdate. Revenue is bucketed by payment date when
 * present, otherwise createdate.
 */
export async function fetchDealsFunnel(
  token: string,
  cfg: DealsConfig,
  since: string,
  until: string
): Promise<DealsFunnel> {
  const sinceMs = new Date(`${since}T00:00:00-03:00`).getTime();
  const untilMs = new Date(`${until}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000;

  const props = ["dealstage", "createdate", cfg.amountProperty, cfg.paymentDateProperty];
  const deals: DealResult[] = [];
  let after: string | undefined;
  do {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: "pipeline", operator: "EQ", value: cfg.pipelineId },
            { propertyName: cfg.productProperty, operator: "EQ", value: cfg.productValue },
            { propertyName: "createdate", operator: "GTE", value: String(sinceMs) },
            { propertyName: "createdate", operator: "LT", value: String(untilMs) },
          ],
        },
      ],
      properties: props,
      sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
      limit: 100,
      ...(after ? { after } : {}),
    };

    const json = await fetchJson<SearchResponse>(`${API}/crm/v3/objects/deals/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    deals.push(...json.results);
    after = json.paging?.next?.after;
    if (after) await sleep(120);
  } while (after);

  const { closed, abandoned, waiting, lost } = cfg.stages;
  const totals = { closed: 0, abandoned: 0, waiting: 0, lost: 0, revenue: 0 };
  const salesByDay = new Map<string, { closed: number; abandoned: number; waiting: number }>();
  const revenueByDay = new Map<string, number>();

  for (const d of deals) {
    const p = d.properties;
    const stage = p.dealstage ?? "";
    const created = p.createdate;
    const day = created ? brDay(created) : null;
    const amount = Number(p[cfg.amountProperty]) || 0;

    const bucket = (key: "closed" | "abandoned" | "waiting") => {
      if (!day) return;
      const e = salesByDay.get(day) ?? { closed: 0, abandoned: 0, waiting: 0 };
      e[key] += 1;
      salesByDay.set(day, e);
    };

    if (stage === closed) {
      totals.closed += 1;
      totals.revenue += amount;
      bucket("closed");
      const payDay = p[cfg.paymentDateProperty] ? brDay(p[cfg.paymentDateProperty]!) : day;
      if (payDay) revenueByDay.set(payDay, (revenueByDay.get(payDay) ?? 0) + amount);
    } else if (stage === abandoned) {
      totals.abandoned += 1;
      bucket("abandoned");
    } else if (stage === waiting) {
      totals.waiting += 1;
      bucket("waiting");
    } else if (stage === lost) {
      totals.lost += 1;
    }
  }

  const dailySales = Array.from(salesByDay.entries())
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
  const dailyRevenue = Array.from(revenueByDay.entries())
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  const denom = totals.closed + totals.abandoned + totals.waiting;
  return {
    totals,
    conclusionRate: denom > 0 ? totals.closed / denom : null,
    dailySales,
    dailyRevenue,
  };
}
