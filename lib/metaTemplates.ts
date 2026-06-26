import { brDay } from "./format";

const GRAPH = "https://graph.facebook.com/v22.0";

/** Resolve the b2c WABA id the same way the cron capture does. */
export function resolveWabaId(): string | undefined {
  return process.env.META_WABA_ID?.trim() ?? process.env.META_AD_ACCOUNT_ID?.trim();
}

export function resolveToken(): string | undefined {
  return process.env.META_ACCESS_TOKEN?.trim();
}

export type TemplateButton = {
  type: string;
  text: string;
  url?: string;
};

export type TemplateSummary = {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  preview: {
    headerImageUrl: string | null;
    bodyText: string | null;
    footerText: string | null;
    buttons: TemplateButton[];
  };
};

type GraphComponent = {
  type: string;
  format?: string;
  text?: string;
  example?: { header_handle?: string[] };
  buttons?: Array<{ type: string; text: string; url?: string }>;
};

type GraphTemplate = {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components?: GraphComponent[];
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

function buildPreview(components: GraphComponent[] = []): TemplateSummary["preview"] {
  let headerImageUrl: string | null = null;
  let bodyText: string | null = null;
  let footerText: string | null = null;
  let buttons: TemplateButton[] = [];

  for (const c of components) {
    const type = (c.type || "").toUpperCase();
    if (type === "HEADER" && (c.format || "").toUpperCase() === "IMAGE") {
      headerImageUrl = c.example?.header_handle?.[0] ?? null;
    } else if (type === "BODY") {
      bodyText = c.text ?? null;
    } else if (type === "FOOTER") {
      footerText = c.text ?? null;
    } else if (type === "BUTTONS" && Array.isArray(c.buttons)) {
      buttons = c.buttons.map((b) => ({ type: b.type, text: b.text, url: b.url }));
    }
  }

  return { headerImageUrl, bodyText, footerText, buttons };
}

/** List message templates for the WABA, newest-usable first. */
export async function listTemplates(token: string, wabaId: string): Promise<TemplateSummary[]> {
  const id = wabaId.trim();
  const tokenParam = encodeURIComponent(token);
  const fields = "name,id,status,category,language,components";
  const url = `${GRAPH}/${id}/message_templates?fields=${fields}&limit=200&access_token=${tokenParam}`;
  const json = await fetchJson<{ data: GraphTemplate[] }>(url);

  return (json.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    category: t.category,
    language: t.language,
    preview: buildPreview(t.components),
  }));
}

export type TemplateDailyPoint = {
  day: string;
  sent: number;
  delivered: number;
  read: number;
  responses: number;
};

export type TemplateAnalytics = {
  currency: string;
  templateId: string;
  totals: {
    sent: number;
    delivered: number;
    read: number;
    /** Unique clicks on URL buttons (denominator for cost_per_url_button_click). */
    urlButtonClicks: number;
    /** Unique quick-reply responses. */
    uniqueResponses: number;
    amountSpent: number;
  };
  /** Derived rates over the whole window. */
  readRate: number | null;
  costPerDelivered: number | null;
  costPerUrlClick: number | null;
  daily: TemplateDailyPoint[];
};

type ClickedEntry = { type: string; value: number };
type CostEntry = { type: string; value: number };
type AnalyticsDataPoint = {
  template_id: string;
  start: number;
  end: number;
  sent?: number;
  delivered?: number;
  read?: number;
  clicked?: ClickedEntry[];
  cost?: CostEntry[];
};
type AnalyticsResponse = {
  currency?: string;
  template_analytics?: {
    data?: Array<{ data_points?: AnalyticsDataPoint[] }>;
  };
};

function sumClicked(clicked: ClickedEntry[] | undefined, ...types: string[]): number {
  if (!clicked) return 0;
  return clicked
    .filter((c) => types.includes(c.type))
    .reduce((s, c) => s + (Number(c.value) || 0), 0);
}

function pickCost(cost: CostEntry[] | undefined, type: string): number {
  if (!cost) return 0;
  const entry = cost.find((c) => c.type === type);
  return entry ? Number(entry.value) || 0 : 0;
}

/**
 * Fetch template_analytics for a single template over [since, until] (YYYY-MM-DD, BRT).
 * Uses the WABA node field-expansion syntax and also pulls the account currency.
 */
export async function fetchTemplateAnalytics(
  token: string,
  wabaId: string,
  templateId: string,
  since: string,
  until: string
): Promise<TemplateAnalytics> {
  const id = wabaId.trim();
  const tokenParam = encodeURIComponent(token);

  // BRT (UTC-3) day boundaries → unix seconds. `end` is exclusive of the next day.
  const startSec = Math.floor(new Date(`${since}T00:00:00-03:00`).getTime() / 1000);
  const endSec = Math.floor(new Date(`${until}T00:00:00-03:00`).getTime() / 1000) + 24 * 60 * 60;

  // metric_types enums MUST be quoted in the field-expansion syntax, or Meta
  // rejects them with "(#100) The parameter metric_types must be an array."
  const metricTypes = ["SENT", "DELIVERED", "READ", "CLICKED", "COST"];
  const metricList = metricTypes.map((m) => `"${m}"`).join(",");
  const fieldExpr =
    `template_analytics.start(${startSec}).end(${endSec}).granularity(DAILY)` +
    `.template_ids([${templateId}]).metric_types([${metricList}])`;
  const fields = encodeURIComponent(`currency,${fieldExpr}`);
  const url = `${GRAPH}/${id}?fields=${fields}&access_token=${tokenParam}`;

  const json = await fetchJson<AnalyticsResponse>(url);
  const points = json.template_analytics?.data?.[0]?.data_points ?? [];

  const byDay = new Map<string, TemplateDailyPoint>();
  const totals = {
    sent: 0,
    delivered: 0,
    read: 0,
    urlButtonClicks: 0,
    uniqueResponses: 0,
    amountSpent: 0,
  };

  for (const p of points) {
    const day = brDay(p.start * 1000);
    const sent = Number(p.sent) || 0;
    const delivered = Number(p.delivered) || 0;
    const read = Number(p.read) || 0;
    const urlClicks = sumClicked(p.clicked, "url_button");
    const responses = sumClicked(p.clicked, "unique_quick_reply_button", "quick_reply_button");

    const entry = byDay.get(day) ?? { day, sent: 0, delivered: 0, read: 0, responses: 0 };
    entry.sent += sent;
    entry.delivered += delivered;
    entry.read += read;
    entry.responses += responses;
    byDay.set(day, entry);

    totals.sent += sent;
    totals.delivered += delivered;
    totals.read += read;
    totals.urlButtonClicks += urlClicks;
    totals.uniqueResponses += responses;
    totals.amountSpent += pickCost(p.cost, "amount_spent");
  }

  const daily = Array.from(byDay.values()).sort((a, b) => (a.day < b.day ? -1 : 1));

  return {
    currency: (json.currency || "USD").toUpperCase(),
    templateId,
    totals,
    readRate: totals.delivered > 0 ? totals.read / totals.delivered : null,
    costPerDelivered: totals.delivered > 0 ? totals.amountSpent / totals.delivered : null,
    costPerUrlClick: totals.urlButtonClicks > 0 ? totals.amountSpent / totals.urlButtonClicks : null,
    daily,
  };
}
