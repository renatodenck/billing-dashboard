// Uso da Anthropic por chave de API (integração). Cruza o usage_report
// (tokens agrupados por api_key_id) com a lista de chaves (para ter o nome).
const ORG = "https://api.anthropic.com/v1/organizations";

export type KeyUsage = {
  keyId: string;
  name: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type ApiKey = { id: string; name: string; status: string };

export async function fetchAnthropicUsageByKey(
  adminKey: string,
  startingAt: string,
  endingAt: string
): Promise<KeyUsage[]> {
  const headers = { "x-api-key": adminKey, "anthropic-version": "2023-06-01" };

  // 1) Mapa api_key_id -> nome/status (best-effort; se falhar, mostra o id).
  const keyMap = new Map<string, ApiKey>();
  try {
    const res = await fetch(`${ORG}/api_keys?limit=100`, { headers, cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as { data?: ApiKey[] };
      for (const k of j.data ?? []) keyMap.set(k.id, k);
    }
  } catch {
    // ignora — usamos o id como nome
  }

  // 2) Uso agrupado por api_key_id (paginado).
  const agg = new Map<string, { input: number; output: number }>();
  let page: string | null = null;
  do {
    const p = new URLSearchParams({
      starting_at: startingAt,
      ending_at: endingAt,
      bucket_width: "1d",
      limit: "31",
    });
    p.append("group_by[]", "api_key_id");
    if (page) p.set("page", page);

    const res = await fetch(`${ORG}/usage_report/messages?${p}`, { headers, cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic usage_report ${res.status}: ${text.slice(0, 200)}`);
    }
    const j = (await res.json()) as {
      data?: Array<{ results?: UsageResult[] }>;
      has_more?: boolean;
      next_page?: string | null;
    };
    for (const b of j.data ?? []) {
      for (const r of b.results ?? []) {
        const id = r.api_key_id ?? "(sem chave)";
        const cur = agg.get(id) ?? { input: 0, output: 0 };
        const cc = r.cache_creation ?? {};
        cur.input +=
          (r.uncached_input_tokens ?? 0) +
          (cc.ephemeral_1h_input_tokens ?? 0) +
          (cc.ephemeral_5m_input_tokens ?? 0) +
          (r.cache_read_input_tokens ?? 0);
        cur.output += r.output_tokens ?? 0;
        agg.set(id, cur);
      }
    }
    page = j.has_more ? j.next_page ?? null : null;
  } while (page);

  const out: KeyUsage[] = [];
  for (const [id, v] of agg) {
    if (v.input + v.output === 0) continue;
    const meta = keyMap.get(id);
    out.push({
      keyId: id,
      name: meta?.name ?? (id === "(sem chave)" ? "Sem chave / outros" : id),
      status: meta?.status ?? "?",
      inputTokens: v.input,
      outputTokens: v.output,
      totalTokens: v.input + v.output,
    });
  }
  out.sort((a, b) => b.totalTokens - a.totalTokens);
  return out;
}

type UsageResult = {
  uncached_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number };
  api_key_id?: string | null;
};
