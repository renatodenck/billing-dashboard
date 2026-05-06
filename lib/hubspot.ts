const API = "https://api.hubapi.com";

type Pipeline = { id: string; label: string };
type PipelinesResponse = { results: Pipeline[] };

type DealSearchResult = {
  id: string;
  properties: { createdate: string };
};

type DealSearchResponse = {
  total: number;
  results: DealSearchResult[];
  paging?: { next?: { after?: string } };
};

export type HubSpotLeads = {
  totalLeads: number;
  daily: Array<{ day: string; amount: number }>;
  pipelineName: string;
  pipelineId: string;
};

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

async function resolvePipelineId(token: string, pipelineName: string): Promise<string> {
  const json = await fetchJson<PipelinesResponse>(`${API}/crm/v3/pipelines/deals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const match = json.results.find(
    (p) => p.label.trim().toLowerCase() === pipelineName.trim().toLowerCase()
  );
  if (!match) {
    const available = json.results.map((p) => `"${p.label}"`).join(", ");
    throw new Error(
      `HubSpot pipeline "${pipelineName}" not found. Available: ${available}`
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
  const looksLikeId = /^\d+$/.test(pipelineNameOrId.trim());
  const pipelineId = looksLikeId
    ? pipelineNameOrId.trim()
    : await resolvePipelineId(token, pipelineNameOrId);

  const now = Date.now();
  const since = now - days * 24 * 60 * 60 * 1000;

  const deals: DealSearchResult[] = [];
  let after: string | undefined;
  do {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: "pipeline", operator: "EQ", value: pipelineId },
            { propertyName: "createdate", operator: "GTE", value: String(since) },
            { propertyName: "createdate", operator: "LTE", value: String(now) },
          ],
        },
      ],
      properties: ["createdate"],
      sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
      limit: 100,
      ...(after ? { after } : {}),
    };

    const json = await fetchJson<DealSearchResponse>(
      `${API}/crm/v3/objects/deals/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    deals.push(...json.results);
    after = json.paging?.next?.after;
  } while (after);

  const byDay = new Map<string, number>();
  for (const d of deals) {
    const key = dayKey(d.properties.createdate);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const daily = Array.from(byDay.entries())
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  return {
    totalLeads: deals.length,
    daily,
    pipelineName: looksLikeId ? `pipeline:${pipelineId}` : pipelineNameOrId,
    pipelineId,
  };
}
