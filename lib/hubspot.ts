const API = "https://api.hubapi.com";
const OBJECT_TYPE = "leads";
const CREATEDATE_PROP = "hs_createdate";
const PIPELINE_PROP = "hs_pipeline";

type Pipeline = { id: string; label: string };
type PipelinesResponse = { results: Pipeline[] };

type LeadSearchResult = {
  id: string;
  properties: Record<string, string | null>;
};

type LeadSearchResponse = {
  total: number;
  results: LeadSearchResult[];
  paging?: { next?: { after?: string } };
};

export type HubSpotLeads = {
  totalLeads: number;
  daily: Array<{ day: string; amount: number }>;
  pipelineName: string;
  pipelineId: string;
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

async function resolvePipelineId(token: string, pipelineName: string): Promise<string> {
  const json = await fetchJson<PipelinesResponse>(
    `${API}/crm/v3/pipelines/${OBJECT_TYPE}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const norm = (s: string) => s.trim().toLowerCase();
  const target = norm(pipelineName);
  const match = json.results.find((p) => norm(p.label) === target);
  if (!match) {
    const available = json.results.map((p) => `"${p.label}"`).join(", ");
    throw new Error(
      `HubSpot ${OBJECT_TYPE} pipeline "${pipelineName}" not found. Available: ${available}`
    );
  }
  return match.id;
}

function dayKey(input: string | number): string {
  return new Date(typeof input === "string" ? input : Number(input))
    .toISOString()
    .slice(0, 10);
}

export async function fetchHubSpotLeads(
  token: string,
  pipelineNameOrId: string,
  days = 90
): Promise<HubSpotLeads> {
  const trimmed = pipelineNameOrId.trim();
  const looksLikeId = /^[0-9]+$/.test(trimmed);
  const pipelineId = looksLikeId
    ? trimmed
    : await resolvePipelineId(token, trimmed);

  const now = Date.now();
  const since = now - days * 24 * 60 * 60 * 1000;

  const leads: LeadSearchResult[] = [];
  let after: string | undefined;
  do {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: PIPELINE_PROP, operator: "EQ", value: pipelineId },
            { propertyName: CREATEDATE_PROP, operator: "GTE", value: String(since) },
            { propertyName: CREATEDATE_PROP, operator: "LTE", value: String(now) },
          ],
        },
      ],
      properties: [CREATEDATE_PROP],
      sorts: [{ propertyName: CREATEDATE_PROP, direction: "ASCENDING" }],
      limit: 100,
      ...(after ? { after } : {}),
    };

    const json = await fetchJson<LeadSearchResponse>(
      `${API}/crm/v3/objects/${OBJECT_TYPE}/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    leads.push(...json.results);
    after = json.paging?.next?.after;
    if (after) await sleep(120);
  } while (after);

  const byDay = new Map<string, number>();
  for (const r of leads) {
    const created = r.properties[CREATEDATE_PROP];
    if (!created) continue;
    const key = dayKey(created);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const daily = Array.from(byDay.entries())
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  return {
    totalLeads: leads.length,
    daily,
    pipelineName: looksLikeId ? `pipeline:${pipelineId}` : trimmed,
    pipelineId,
  };
}
