// Microsoft Clarity Data Export API.
// Limitation (Microsoft's): only the last 1–3 days, whole-project aggregate,
// ~10 calls/day, no custom date range and no heatmap image.
// We request a single call broken down by Device (dimension1) and aggregate
// the overall totals ourselves, so we still spend only 1 call per refresh.

const CLARITY_API = "https://www.clarity.ms/export-data/api/v1/project-live-insights";

export type DeviceBreakdown = { device: string; sessions: number; users: number };

/** A Clarity "insight" smart event: sessions affected + total occurrences. */
export type SmartEvent = { sessions: number; total: number };

export type ClarityInsights = {
  numOfDays: number;
  sessions: number;
  bots: number;
  uniqueUsers: number;
  pagesPerSession: number | null;
  avgScrollDepth: number | null;
  totalTimeMin: number | null;
  activeTimeMin: number | null;
  rageClicks: SmartEvent;
  deadClicks: SmartEvent;
  excessiveScroll: SmartEvent;
  quickbackClicks: SmartEvent;
  errorClicks: SmartEvent;
  devices: DeviceBreakdown[];
};

type Row = Record<string, unknown>;
type Metric = { metricName: string; information: Row[] };

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// The dimension value comes back under a key named after the dimension. Be
// tolerant about the exact key/casing and normalize to a friendly label.
function deviceLabel(row: Row): string {
  const raw =
    (row.Device ?? row.device ?? row.deviceType ?? row.Dimension ?? "")?.toString().trim() ?? "";
  const v = raw.toLowerCase();
  if (v.includes("mobile") || v.includes("phone")) return "Mobile";
  if (v.includes("tablet")) return "Tablet";
  if (v.includes("pc") || v.includes("desktop")) return "Desktop";
  return raw || "Outro";
}

export async function fetchClarityInsights(token: string, numOfDays = 3): Promise<ClarityInsights> {
  const res = await fetch(`${CLARITY_API}?numOfDays=${numOfDays}&dimension1=Device`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clarity API ${res.status}: ${text}`);
  }
  const data = (await res.json()) as Metric[];
  const rows = (name: string): Row[] => data.find((m) => m.metricName === name)?.information ?? [];

  // Traffic per device → device breakdown + summed totals.
  const trafficRows = rows("Traffic");
  const sessionsByDevice = new Map<string, number>();
  let sessions = 0;
  let bots = 0;
  let uniqueUsers = 0;
  let ppsWeighted = 0;
  const devices: DeviceBreakdown[] = [];
  for (const r of trafficRows) {
    const label = deviceLabel(r);
    const s = num(r.totalSessionCount);
    const u = num(r.distinctUserCount);
    sessions += s;
    bots += num(r.totalBotSessionCount);
    uniqueUsers += u;
    ppsWeighted += num(r.pagesPerSessionPercentage) * s;
    sessionsByDevice.set(label, (sessionsByDevice.get(label) ?? 0) + s);
    const existing = devices.find((d) => d.device === label);
    if (existing) {
      existing.sessions += s;
      existing.users += u;
    } else {
      devices.push({ device: label, sessions: s, users: u });
    }
  }
  devices.sort((a, b) => b.sessions - a.sessions);

  // Scroll depth: session-weighted average across devices.
  let scrollWeighted = 0;
  let scrollWeight = 0;
  for (const r of rows("ScrollDepth")) {
    const w = sessionsByDevice.get(deviceLabel(r)) ?? 0;
    const sd = Number(r.averageScrollDepth);
    if (Number.isFinite(sd) && w > 0) {
      scrollWeighted += sd * w;
      scrollWeight += w;
    }
  }

  // Engagement and click-quality metrics: sum across device rows.
  let totalTime = 0;
  let activeTime = 0;
  for (const r of rows("EngagementTime")) {
    totalTime += num(r.totalTime);
    activeTime += num(r.activeTime);
  }
  // Smart events: sessions affected + total occurrences, summed across devices.
  const event = (name: string): SmartEvent =>
    rows(name).reduce(
      (acc, r) => ({ sessions: acc.sessions + num(r.sessionsCount), total: acc.total + num(r.subTotal) }),
      { sessions: 0, total: 0 }
    );

  return {
    numOfDays,
    sessions,
    bots,
    uniqueUsers,
    pagesPerSession: sessions > 0 ? ppsWeighted / sessions : null,
    avgScrollDepth: scrollWeight > 0 ? scrollWeighted / scrollWeight : null,
    totalTimeMin: totalTime > 0 ? totalTime : null,
    activeTimeMin: activeTime > 0 ? activeTime : null,
    rageClicks: event("RageClickCount"),
    deadClicks: event("DeadClickCount"),
    excessiveScroll: event("ExcessiveScroll"),
    quickbackClicks: event("QuickbackClick"),
    errorClicks: event("ErrorClickCount"),
    devices,
  };
}
