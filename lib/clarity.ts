// Microsoft Clarity Data Export API.
// Limitation (Microsoft's): only the last 1–3 days, whole-project aggregate,
// no custom date range and no heatmap image (heatmap lives in Clarity's UI).

const CLARITY_API = "https://www.clarity.ms/export-data/api/v1/project-live-insights";

export type ClarityInsights = {
  numOfDays: number;
  sessions: number;
  bots: number;
  uniqueUsers: number;
  pagesPerSession: number | null;
  avgScrollDepth: number | null;
  totalTimeMin: number | null;
  activeTimeMin: number | null;
  deadClicks: number;
  rageClicks: number;
  quickbackClicks: number;
  errorClicks: number;
};

type Metric = { metricName: string; information: Array<Record<string, unknown>> };

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchClarityInsights(token: string, numOfDays = 3): Promise<ClarityInsights> {
  const res = await fetch(`${CLARITY_API}?numOfDays=${numOfDays}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clarity API ${res.status}: ${text}`);
  }
  const data = (await res.json()) as Metric[];
  const first = (name: string): Record<string, unknown> =>
    data.find((m) => m.metricName === name)?.information?.[0] ?? {};
  const subTotal = (name: string): number => num(first(name).subTotal);

  const traffic = first("Traffic");
  const scroll = first("ScrollDepth");
  const eng = first("EngagementTime");

  return {
    numOfDays,
    sessions: num(traffic.totalSessionCount),
    bots: num(traffic.totalBotSessionCount),
    uniqueUsers: num(traffic.distinctUserCount),
    pagesPerSession: numOrNull(traffic.pagesPerSessionPercentage),
    avgScrollDepth: numOrNull(scroll.averageScrollDepth),
    totalTimeMin: numOrNull(eng.totalTime),
    activeTimeMin: numOrNull(eng.activeTime),
    deadClicks: subTotal("DeadClickCount"),
    rageClicks: subTotal("RageClickCount"),
    quickbackClicks: subTotal("QuickbackClick"),
    errorClicks: subTotal("ErrorClickCount"),
  };
}
