import { brDay } from "./format";

const API = "https://api.hubapi.com";
const OBJECT_TYPE = "leads";
const PIPELINE_PROP = "hs_pipeline";

type Pipeline = { id: string; label: string; stages: PipelineStage[] };
type PipelineStage = { id: string; label: string };
type PipelinesResponse = { results: Pipeline[] };

type LeadProperty = { name: string; label: string };
type PropertiesResponse = { results: LeadProperty[] };

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
  stageName: string;
  stageId: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(url: string, init: RequestInit, attempt = 0): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (res.status === 429 && attempt < 5) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1);
    await sleep(waitMs);
    return fetchJson<T>(url, init, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

async function resolvePipelineStageAndProperty(
  token: string,
  pipelineNameOrId: string,
  stageName: string
): Promise<{
  pipelineId: string;
  pipelineLabel: string;
  stageId: string;
  stageLabel: string;
  dateEnteredProperty: string;
}> {
  const json = await fetchJson<PipelinesResponse>(`${API}/crm/v3/pipelines/${OBJECT_TYPE}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const norm = (s: string) => s.trim().toLowerCase();
  const pTarget = norm(pipelineNameOrId);
  const looksLikeId = /^[0-9]+$/.test(pipelineNameOrId.trim());

  const pipeline = json.results.find((p) =>
    looksLikeId ? p.id === pipelineNameOrId.trim() : norm(p.label) === pTarget
  );
  if (!pipeline) {
    const available = json.results.map((p) => `"${p.label}"`).join(", ");
    throw new Error(`HubSpot pipeline "${pipelineNameOrId}" not found. Available: ${available}`);
  }

  const sTarget = norm(stageName);
  const stage = pipeline.stages.find((s) => norm(s.label) === sTarget);
  if (!stage) {
    const available = pipeline.stages.map((s) => `"${s.label}"`).join(", ");
    throw new Error(
      `HubSpot stage "${stageName}" not found in pipeline "${pipeline.label}". Available: ${available}`
    );
  }

  // Property name format depends on stage ID type. Numeric IDs produce hs_v2_date_entered_<id>,
  // but slug-based IDs add an opaque suffix (e.g. hs_v2_date_entered_qualified_stage_id_233247981).
  // Resolving by label avoids the guesswork.
  const stageIdIsNumeric = /^[0-9]+$/.test(stage.id);
  let dateEnteredProperty = `hs_v2_date_entered_${stage.id}`;
  if (!stageIdIsNumeric) {
    const propsJson = await fetchJson<PropertiesResponse>(
      `${API}/crm/v3/properties/${OBJECT_TYPE}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const expected = `Date entered "${stage.label} (${pipeline.label})"`;
    const expectedNorm = norm(expected);
    const match = propsJson.results.find(
      (p) => p.name.startsWith("hs_v2_date_entered_") && norm(p.label) === expectedNorm
    );
    if (!match) {
      throw new Error(
        `HubSpot date_entered property not found for stage "${stage.label}" in pipeline "${pipeline.label}".`
      );
    }
    dateEnteredProperty = match.name;
  }

  return {
    pipelineId: pipeline.id,
    pipelineLabel: pipeline.label,
    stageId: stage.id,
    stageLabel: stage.label,
    dateEnteredProperty,
  };
}

export async function fetchHubSpotLeads(
  token: string,
  pipelineNameOrId: string,
  stageName: string,
  days = 90
): Promise<HubSpotLeads> {
  const { pipelineId, pipelineLabel, stageId, stageLabel, dateEnteredProperty } =
    await resolvePipelineStageAndProperty(token, pipelineNameOrId, stageName);

  const stageDateProp = dateEnteredProperty;
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
            { propertyName: stageDateProp, operator: "GTE", value: String(since) },
            { propertyName: stageDateProp, operator: "LTE", value: String(now) },
          ],
        },
      ],
      properties: [stageDateProp],
      sorts: [{ propertyName: stageDateProp, direction: "ASCENDING" }],
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
    const stageDate = r.properties[stageDateProp];
    if (!stageDate) continue;
    const key = brDay(stageDate);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const daily = Array.from(byDay.entries())
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  return {
    totalLeads: leads.length,
    daily,
    pipelineName: pipelineLabel,
    pipelineId,
    stageName: stageLabel,
    stageId,
  };
}

// ---------- Meetings ----------

type MeetingSearchResult = {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
};

type MeetingSearchResponse = {
  total: number;
  results: MeetingSearchResult[];
  paging?: { next?: { after?: string } };
};

export type HubSpotMeetings = {
  total: number;
  daily: Array<{ day: string; amount: number }>;
};

export async function fetchHubSpotMeetings(
  token: string,
  ownerIds: string[],
  excludedActivityTypes: string[],
  days = 60
): Promise<HubSpotMeetings> {
  const now = Date.now();
  const since = now - days * 24 * 60 * 60 * 1000;

  // Common filters (createdate range + assignee in owner list).
  const commonFilters: Array<Record<string, unknown>> = [
    { propertyName: "hs_createdate", operator: "GTE", value: String(since) },
    { propertyName: "hs_createdate", operator: "LT", value: String(now) },
    { propertyName: "hubspot_owner_id", operator: "IN", values: ownerIds },
  ];

  // Two filterGroups OR'd: (type NOT_IN excluded) OR (type is empty).
  // HubSpot's NOT_IN does NOT include records without a value, so we need both groups.
  const filterGroups = [
    {
      filters: [
        ...commonFilters,
        { propertyName: "hs_activity_type", operator: "NOT_IN", values: excludedActivityTypes },
      ],
    },
    {
      filters: [
        ...commonFilters,
        { propertyName: "hs_activity_type", operator: "NOT_HAS_PROPERTY" },
      ],
    },
  ];

  const meetings: MeetingSearchResult[] = [];
  let after: string | undefined;
  do {
    const body = {
      filterGroups,
      properties: ["hs_createdate", "hs_activity_type"],
      sorts: [{ propertyName: "hs_createdate", direction: "ASCENDING" }],
      limit: 100,
      ...(after ? { after } : {}),
    };

    const json = await fetchJson<MeetingSearchResponse>(
      `${API}/crm/v3/objects/meetings/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    meetings.push(...json.results);
    after = json.paging?.next?.after;
    if (after) await sleep(120);
  } while (after);

  const byDay = new Map<string, number>();
  for (const m of meetings) {
    const created = m.properties.hs_createdate ?? m.createdAt;
    if (!created) continue;
    const day = brDay(created);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const daily = Array.from(byDay.entries())
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  return { total: meetings.length, daily };
}

