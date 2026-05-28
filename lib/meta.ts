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

// ---------- Template-filtered cost (proportional approximation) ----------

type TemplateListItem = { id: string; name: string };
type TemplateListResponse = {
  data: TemplateListItem[];
  paging?: { next?: string };
};

type TemplateAnalyticsPoint = {
  template_id: string;
  start: number;
  end: number;
  sent?: number;
};
type TemplateAnalyticsResponse = {
  data: Array<{ data_points: TemplateAnalyticsPoint[] }>;
  paging?: { cursors?: { after?: string }; next?: string };
};

async function listAllTemplates(token: string, wabaId: string): Promise<TemplateListItem[]> {
  const tokenParam = encodeURIComponent(token);
  const items: TemplateListItem[] = [];
  let next: string | undefined = `${GRAPH}/${wabaId}/message_templates?fields=name,id&limit=100&access_token=${tokenParam}`;
  while (next) {
    const json: TemplateListResponse = await fetchJson<TemplateListResponse>(next);
    items.push(...json.data);
    next = json.paging?.next;
  }
  return items;
}

async function fetchSentByTemplateByDay(
  token: string,
  wabaId: string,
  templateIds: string[],
  startUnix: number,
  endUnix: number
): Promise<Map<string, Map<string, number>>> {
  // Returns: day -> templateId -> sent count
  const result = new Map<string, Map<string, number>>();
  if (templateIds.length === 0) return result;

  // Meta's template_analytics caps template_ids at 10 per call.
  const CHUNK = 10;
  for (let i = 0; i < templateIds.length; i += CHUNK) {
    const batch = templateIds.slice(i, i + CHUNK);
    const idsJson = JSON.stringify(batch);
    const metricsJson = JSON.stringify(["SENT"]);
    const url =
      `${GRAPH}/${wabaId}/template_analytics?` +
      `start=${startUnix}&end=${endUnix}&granularity=DAILY` +
      `&template_ids=${encodeURIComponent(idsJson)}` +
      `&metric_types=${encodeURIComponent(metricsJson)}` +
      `&limit=600` +
      `&access_token=${encodeURIComponent(token)}`;

    // Single fetch with high limit to avoid paginated calls (Meta returns 401 on follow-up pages).
    const json: TemplateAnalyticsResponse = await fetchJson<TemplateAnalyticsResponse>(url);
    for (const grp of json.data ?? []) {
      for (const p of grp.data_points ?? []) {
        const day = brDay(p.start * 1000);
        const sent = Number(p.sent) || 0;
        if (sent === 0) continue;
        let inner = result.get(day);
        if (!inner) {
          inner = new Map<string, number>();
          result.set(day, inner);
        }
        inner.set(p.template_id, (inner.get(p.template_id) ?? 0) + sent);
      }
    }
  }
  return result;
}

export async function fetchMetaUsageMinusTemplates(
  accessToken: string,
  wabaId: string,
  excludedTemplateNames: string[],
  days = 60
): Promise<MetaUsage & { rawTotalSpent: number; excludedRatio: number }> {
  const full = await fetchMetaUsage(accessToken, wabaId, days);

  if (excludedTemplateNames.length === 0) {
    return { ...full, rawTotalSpent: full.totalSpent, excludedRatio: 0 };
  }

  const templates = await listAllTemplates(accessToken, wabaId);
  const excludedSet = new Set(excludedTemplateNames.map((s) => s.trim().toLowerCase()));
  const excludedIds = new Set(
    templates.filter((t) => excludedSet.has(t.name.trim().toLowerCase())).map((t) => t.id)
  );
  const allIds = templates.map((t) => t.id);

  const now = Math.floor(Date.now() / 1000);
  const since = now - days * 24 * 60 * 60;
  const sentByDay = await fetchSentByTemplateByDay(accessToken, wabaId, allIds, since, now);

  let excludedSends = 0;
  let totalSends = 0;
  const adjustedDaily = full.daily.map(({ day, amount }) => {
    const inner = sentByDay.get(day);
    if (!inner || inner.size === 0) return { day, amount };
    let dayTotal = 0;
    let dayExcluded = 0;
    for (const [tplId, sent] of inner) {
      dayTotal += sent;
      if (excludedIds.has(tplId)) dayExcluded += sent;
    }
    totalSends += dayTotal;
    excludedSends += dayExcluded;
    if (dayTotal === 0) return { day, amount };
    const keepRatio = (dayTotal - dayExcluded) / dayTotal;
    return { day, amount: amount * keepRatio };
  });

  const totalSpent = adjustedDaily.reduce((s, d) => s + d.amount, 0);
  const today = brDay();
  const monthStart = `${today.slice(0, 7)}-01`;
  const spentToday = adjustedDaily.find((d) => d.day === today)?.amount ?? 0;
  const spentMonth = adjustedDaily
    .filter((d) => d.day >= monthStart)
    .reduce((s, d) => s + d.amount, 0);

  return {
    ...full,
    daily: adjustedDaily,
    totalSpent,
    spentToday,
    spentMonth,
    rawTotalSpent: full.totalSpent,
    excludedRatio: totalSends > 0 ? excludedSends / totalSends : 0,
  };
}

