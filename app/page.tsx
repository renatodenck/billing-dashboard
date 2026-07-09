"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw, Users } from "lucide-react";
import type { DashboardPayload } from "./api/data/route";
import type { SubscriptionDTO } from "./api/subscriptions/route";
import { formatDateBR, formatMoney } from "@/lib/format";
import {
  filterDaily,
  formatRangeLabel,
  PRESET_LABELS,
  presetToRange,
  rangeStats,
  type DateRange,
  type RangePreset,
} from "@/lib/dateRange";

const SOURCE_META = {
  openai: { label: "OpenAI", accent: "#FF640F", soft: "#FFE5D5", caption: "Inteligência Artificial" },
  anthropic: { label: "Anthropic", accent: "#CC785C", soft: "#F5E1D6", caption: "Claude (Sonnet/Opus)" },
  meta: { label: "WhatsApp B2C", accent: "#053CAA", soft: "#E1E9FF", caption: "Custo de disparo" },
  meta_b2b: { label: "WhatsApp B2B", accent: "#1E3A8A", soft: "#DBEAFE", caption: "Custo de disparo" },
} as const;

type SourceKey = keyof typeof SOURCE_META;

// Fontes cujo gasto se divide em tokens de modelo (linha laranja) vs. tudo o
// mais que a plataforma cobra — web search, code execution, storage, imagens
// (linha azul).
const TOKEN_SPLIT_SOURCES = new Set<SourceKey>(["openai", "anthropic"]);
const OTHER_COST_COLOR = "#2563EB";

const PRESET_ORDER: RangePreset[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "60d",
  "thisMonth",
  "lastMonth",
  "all",
  "custom",
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { since: today, until: today };
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DashboardPayload;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const allDaily = useMemo(() => {
    if (!data) return [];
    return [...(data.daily.openai ?? []), ...(data.daily.meta ?? [])];
  }, [data]);

  const range = useMemo(
    () => presetToRange(preset, customRange, allDaily),
    [preset, customRange, allDaily]
  );

  const lastUpdate = useMemo(() => {
    if (!data) return null;
    const stamps = Object.values(data.sources)
      .map((s) => (s.capturedAt ? new Date(s.capturedAt).getTime() : 0))
      .filter((t) => t > 0);
    if (stamps.length === 0) return null;
    return new Date(Math.max(...stamps));
  }, [data]);

  return (
    <div>
      <header className="border-b border-psa-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <PsaLogo />
            <div className="hidden h-8 w-px bg-psa-line sm:block" />
            <div className="hidden sm:block">
              <h1 className="text-base font-semibold tracking-tight text-psa-ink">
                Custos de IA &amp; Mídia
              </h1>
              <p className="text-xs text-psa-muted">Profissionaissa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/assinaturas"
              className="inline-flex items-center gap-2 rounded-full border border-psa-line bg-white px-4 py-1.5 text-sm font-medium text-psa-ink transition hover:border-psa-orange hover:text-psa-orange"
            >
              Assinaturas
            </a>
            <a
              href="/templates"
              className="inline-flex items-center gap-2 rounded-full border border-psa-line bg-white px-4 py-1.5 text-sm font-medium text-psa-ink transition hover:border-psa-orange hover:text-psa-orange"
            >
              Templates WhatsApp
            </a>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-psa-line bg-white px-4 py-1.5 text-sm font-medium text-psa-ink transition hover:border-psa-orange hover:text-psa-orange disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-psa-orange">
              Painel financeiro
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-psa-ink sm:text-4xl">
              Custos de IA &amp; Mídia
            </h2>
            <p className="mt-2 max-w-xl text-sm text-psa-muted">
              Snapshots automáticos às <strong className="text-psa-ink">08:00</strong>,{" "}
              <strong className="text-psa-ink">12:00</strong> e{" "}
              <strong className="text-psa-ink">16:00</strong> (horário de Brasília).
            </p>
          </div>
          {lastUpdate && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-psa-muted">Última atualização</p>
              <p className="text-sm font-medium text-psa-ink">
                {lastUpdate.toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            </div>
          )}
        </div>

        <RangeBar
          preset={preset}
          customRange={customRange}
          range={range}
          onPreset={setPreset}
          onCustomRange={(r) => {
            setCustomRange(r);
            setPreset("custom");
          }}
        />

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Erro ao carregar dados: {error}
          </div>
        )}

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <SourceCard source="openai" data={data} range={range} />
          <SourceCard source="anthropic" data={data} range={range} />
        </div>

        <div className="mb-6">
          <SubscriptionsCard />
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <SourceCard source="meta" data={data} range={range} />
          <SourceCard source="meta_b2b" data={data} range={range} />
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <AcquisitionCard variant="b2c" data={data} range={range} />
          <AcquisitionCard variant="b2b" data={data} range={range} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <MeetingsCard data={data} range={range} />
        </div>

        <footer className="mt-12 border-t border-psa-line pt-6 text-center text-xs text-psa-muted">
          PSA · Aprender é o maior Show da Terra
        </footer>
      </main>
    </div>
  );
}

function RangeBar({
  preset,
  customRange,
  range,
  onPreset,
  onCustomRange,
}: {
  preset: RangePreset;
  customRange: DateRange;
  range: DateRange;
  onPreset: (p: RangePreset) => void;
  onCustomRange: (r: DateRange) => void;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-psa-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESET_ORDER.map((p) => {
            const active = preset === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPreset(p)}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-medium transition " +
                  (active
                    ? "bg-psa-ink text-white"
                    : "bg-white text-psa-muted hover:bg-psa-line/40 hover:text-psa-ink")
                }
              >
                {PRESET_LABELS[p]}
              </button>
            );
          })}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">
            Período selecionado
          </p>
          <p className="text-sm font-semibold tabular-nums text-psa-ink">
            {formatRangeLabel(range)}
          </p>
        </div>
      </div>

      {preset === "custom" && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-psa-line pt-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">
              De
            </label>
            <input
              type="date"
              value={customRange.since}
              max={customRange.until}
              onChange={(e) =>
                onCustomRange({ ...customRange, since: e.target.value })
              }
              className="mt-1 rounded-md border border-psa-line bg-white px-3 py-1.5 text-sm text-psa-ink focus:border-psa-orange focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">
              Até
            </label>
            <input
              type="date"
              value={customRange.until}
              min={customRange.since}
              onChange={(e) =>
                onCustomRange({ ...customRange, until: e.target.value })
              }
              className="mt-1 rounded-md border border-psa-line bg-white px-3 py-1.5 text-sm text-psa-ink focus:border-psa-orange focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SourceCard({
  source,
  data,
  range,
}: {
  source: SourceKey;
  data: DashboardPayload | null;
  range: DateRange;
}) {
  const meta = SOURCE_META[source];
  const summary = data?.sources[source];
  const dailyAll = data?.daily[source] ?? [];

  const filtered = useMemo(() => filterDaily(dailyAll, range), [dailyAll, range]);
  const stats = useMemo(() => rangeStats(filtered), [filtered]);

  const hasSplit = TOKEN_SPLIT_SOURCES.has(source);
  // Enquanto a quebra da API não é gravada, `tokens`/`other` vêm indefinidos:
  // a linha laranja mostra o total (como hoje) e a azul fica zerada.
  const chartData = useMemo(
    () =>
      filtered.map((d) => ({
        day: d.day,
        amount: d.amount,
        tokens: d.tokens ?? d.amount,
        other: d.other ?? 0,
      })),
    [filtered]
  );

  const currency = summary?.currency ?? "USD";

  return (
    <section className="overflow-hidden rounded-2xl border border-psa-line bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-psa-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: meta.soft, color: meta.accent }}
          >
            {meta.label.slice(0, 1)}
          </span>
          <div>
            <h3 className="text-base font-semibold text-psa-ink">{meta.label}</h3>
            <p className="text-xs text-psa-muted">
              {meta.caption}
              {summary?.accountName ? ` · ${summary.accountName}` : ""}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px bg-psa-line sm:grid-cols-4">
        <Stat
          label="Total no período"
          value={stats.total}
          currency={currency}
          highlight
          accent={meta.accent}
        />
        <Stat
          label="Média/dia"
          value={stats.days > 0 ? stats.avg : null}
          currency={currency}
        />
        <Stat
          label={stats.max.day ? `Pico (${formatDateBR(stats.max.day)})` : "Pico"}
          value={stats.max.amount > 0 ? stats.max.amount : null}
          currency={currency}
        />
        <Stat label="Moeda" raw={currency} />
      </div>

      <div className="px-4 pb-5 pt-4">
        {hasSplit && filtered.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-psa-muted">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: meta.accent }}
              />
              <span className="font-medium text-psa-ink">Tokens</span>
              <span>· uso do modelo</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: OTHER_COST_COLOR }}
              />
              <span className="font-medium text-psa-ink">Outros custos</span>
              <span>· web search, code execution, storage…</span>
            </span>
          </div>
        )}
        <div className="h-44">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-psa-muted">
              {dailyAll.length === 0
                ? "Sem dados ainda — aguarde o primeiro snapshot."
                : "Sem registros no período selecionado."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${source}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={meta.accent} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`grad-other-${source}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={OTHER_COST_COLOR} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={OTHER_COST_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EEF1F5" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatDateBR}
                  stroke="#9AA4B2"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  stroke="#9AA4B2"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E6E9EF",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "0 4px 16px rgba(11,19,32,0.08)",
                  }}
                  labelStyle={{ color: "#0B1320", fontWeight: 600 }}
                  labelFormatter={formatDateBR}
                  formatter={(value: number, name) =>
                    hasSplit
                      ? [formatMoney(value, currency), name]
                      : [formatMoney(value, currency), "Gasto"]
                  }
                />
                {/* Areas como filhos diretos (sem Fragment): o Recharts só
                    detecta componentes de série varrendo os filhos por tipo. */}
                {hasSplit && (
                  <Area
                    key="tokens"
                    type="monotone"
                    dataKey="tokens"
                    name="Tokens"
                    stroke={meta.accent}
                    strokeWidth={2.5}
                    fill={`url(#grad-${source})`}
                  />
                )}
                {hasSplit && (
                  <Area
                    key="other"
                    type="monotone"
                    dataKey="other"
                    name="Outros custos"
                    stroke={OTHER_COST_COLOR}
                    strokeWidth={2}
                    fill={`url(#grad-other-${source})`}
                  />
                )}
                {!hasSplit && (
                  <Area
                    key="amount"
                    type="monotone"
                    dataKey="amount"
                    stroke={meta.accent}
                    strokeWidth={2.5}
                    fill={`url(#grad-${source})`}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

function AcquisitionCard({
  data,
  range,
  variant,
}: {
  data: DashboardPayload | null;
  range: DateRange;
  variant: "b2c" | "b2b";
}) {
  const metaSourceKey = variant === "b2c" ? "meta" : "meta_b2b";
  const leadsSourceKey = variant === "b2c" ? "hubspot_b2c" : "hubspot_b2b";

  const openaiDaily = data?.daily.openai ?? [];
  const metaDaily = data?.daily[metaSourceKey] ?? [];
  const leadsDaily = data?.daily[leadsSourceKey] ?? [];
  const hubspotSource = data?.sources[leadsSourceKey];

  const filteredOpenai = useMemo(() => filterDaily(openaiDaily, range), [openaiDaily, range]);
  const filteredMeta = useMemo(() => filterDaily(metaDaily, range), [metaDaily, range]);
  const filteredLeads = useMemo(() => filterDaily(leadsDaily, range), [leadsDaily, range]);

  // OpenAI is split 50/50 between B2C and B2B CPO (no project breakdown today).
  const openaiSpend = filteredOpenai.reduce((s, d) => s + d.amount, 0) / 2;
  const metaSpend = filteredMeta.reduce((s, d) => s + d.amount, 0);
  const totalLeads = filteredLeads.reduce((s, d) => s + d.amount, 0);

  const openaiCurrency = data?.sources.openai?.currency ?? "USD";
  const metaCurrency = data?.sources[metaSourceKey]?.currency ?? null;

  const usdToBrl = Number(process.env.NEXT_PUBLIC_USD_TO_BRL ?? "5.0") || 5.0;

  // Choose a single currency for the combined CPO.
  const reportCurrency =
    metaCurrency && metaCurrency !== openaiCurrency ? metaCurrency : openaiCurrency;
  const openaiInReport =
    openaiCurrency === reportCurrency
      ? openaiSpend
      : openaiCurrency === "USD" && reportCurrency === "BRL"
        ? openaiSpend * usdToBrl
        : openaiSpend;
  const totalSpend = openaiInReport + metaSpend;
  const cpo = totalLeads > 0 ? totalSpend / totalLeads : null;

  const pipelineLabel = hubspotSource?.accountName ?? "—";
  const hubspotConfigured = leadsDaily.length > 0 || hubspotSource?.capturedAt != null;
  const currencyMismatch = metaCurrency != null && metaCurrency !== openaiCurrency;

  const title = variant === "b2c" ? "Qualificação B2C" : "Qualificação B2B";
  const accentColor = variant === "b2c" ? "#FF640F" : "#053CAA";
  const accentSoft = variant === "b2c" ? "#FFE5D5" : "#E1E9FF";

  if (!hubspotConfigured) {
    const hubspotEnv = variant === "b2c" ? "HUBSPOT_LEAD_PIPELINE" : "HUBSPOT_LEAD_PIPELINE_B2B";
    const stageEnv = variant === "b2c" ? "HUBSPOT_LEAD_STAGE" : "HUBSPOT_LEAD_STAGE_B2B";
    return (
      <section className="rounded-2xl border border-dashed border-psa-line bg-white px-6 py-8 text-center text-sm text-psa-muted">
        Configure <code className="text-psa-ink">{hubspotEnv}</code> e{" "}
        <code className="text-psa-ink">{stageEnv}</code> pra ver o CPO {variant.toUpperCase()} aqui.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-psa-line bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-psa-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: accentSoft, color: accentColor }}
          >
            ⚡
          </span>
          <div>
            <h3 className="text-base font-semibold text-psa-ink">{title}</h3>
            <p className="text-xs text-psa-muted">
              CPO = (½ OpenAI + WhatsApp {variant.toUpperCase()}) ÷ Leads qualificados ·{" "}
              <span className="text-psa-ink">{pipelineLabel}</span>
              {currencyMismatch && (
                <span className="ml-2 inline-flex items-center rounded bg-psa-orange-soft px-1.5 py-0.5 text-[10px] font-semibold text-psa-orange">
                  USD→BRL @ {usdToBrl.toFixed(2)}
                </span>
              )}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px bg-psa-line sm:grid-cols-4">
        <Stat
          label="CPO do período"
          value={cpo}
          currency={reportCurrency}
          highlight
          accent={accentColor}
        />
        <Stat label="Leads qualificados" raw={totalLeads.toLocaleString("pt-BR")} />
        <Stat
          label={`½ Gasto IA${openaiCurrency !== reportCurrency ? ` (${openaiCurrency})` : ""}`}
          value={openaiSpend > 0 ? openaiSpend : null}
          currency={openaiCurrency}
        />
        <Stat
          label="Custo WhatsApp"
          value={metaSpend > 0 ? metaSpend : null}
          currency={metaCurrency ?? reportCurrency}
        />
      </div>

      <div className="px-4 pb-5 pt-4">
        <div className="h-44">
          {filteredLeads.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-psa-muted">
              Sem leads qualificados no período selecionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredLeads}
                margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid stroke="#EEF1F5" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatDateBR}
                  stroke="#9AA4B2"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  stroke="#9AA4B2"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E6E9EF",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "0 4px 16px rgba(11,19,32,0.08)",
                  }}
                  labelStyle={{ color: "#0B1320", fontWeight: 600 }}
                  labelFormatter={formatDateBR}
                  formatter={(value: number) => [`${value} lead${value === 1 ? "" : "s"}`, "Qualificados"]}
                />
                <Bar dataKey="amount" fill="#FF640F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

function MeetingsCard({
  data,
  range,
}: {
  data: DashboardPayload | null;
  range: DateRange;
}) {
  const metaDaily = data?.daily.meta ?? [];
  const meetingsDaily = data?.daily.hubspot_meetings_b2c ?? [];
  const metaSource = data?.sources.meta;
  const meetingsSource = data?.sources.hubspot_meetings_b2c;

  const filteredMeta = useMemo(() => filterDaily(metaDaily, range), [metaDaily, range]);
  const filteredMeetings = useMemo(
    () => filterDaily(meetingsDaily, range),
    [meetingsDaily, range]
  );

  const totalCost = filteredMeta.reduce((s, d) => s + d.amount, 0);
  const totalMeetings = filteredMeetings.reduce((s, d) => s + d.amount, 0);
  const cpr = totalMeetings > 0 ? totalCost / totalMeetings : null;

  const currency = metaSource?.currency ?? "USD";
  const configured =
    meetingsDaily.length > 0 || meetingsSource?.capturedAt != null;

  if (!configured) {
    return (
      <section className="rounded-2xl border border-dashed border-psa-line bg-white px-6 py-8 text-center text-sm text-psa-muted">
        Configure <code className="text-psa-ink">HUBSPOT_MEETING_OWNER_IDS</code> e{" "}
        <code className="text-psa-ink">HUBSPOT_MEETING_EXCLUDED_TYPES</code> pra ver o custo por reunião.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-psa-line bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-psa-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-psa-orange-soft text-sm font-bold text-psa-orange">
            📅
          </span>
          <div>
            <h3 className="text-base font-semibold text-psa-ink">Custo por reunião marcada B2C</h3>
            <p className="text-xs text-psa-muted">
              Custo/reunião = Custo total WhatsApp B2C ÷ reuniões agendadas pelo time SDR
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px bg-psa-line sm:grid-cols-4">
        <Stat
          label="Custo/reunião"
          value={cpr}
          currency={currency}
          highlight
          accent="#FF640F"
        />
        <Stat label="Reuniões marcadas" raw={totalMeetings.toLocaleString("pt-BR")} />
        <Stat
          label="Custo WhatsApp"
          value={totalCost > 0 ? totalCost : null}
          currency={currency}
        />
        <Stat
          label="Média reuniões/dia"
          raw={filteredMeetings.length > 0 && totalMeetings > 0
            ? (totalMeetings / filteredMeetings.length).toFixed(1)
            : "—"}
        />
      </div>

      <div className="px-4 pb-5 pt-4">
        <div className="h-44">
          {filteredMeetings.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-psa-muted">
              Sem reuniões no período selecionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredMeetings}
                margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid stroke="#EEF1F5" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatDateBR}
                  stroke="#9AA4B2"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  stroke="#9AA4B2"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E6E9EF",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "0 4px 16px rgba(11,19,32,0.08)",
                  }}
                  labelStyle={{ color: "#0B1320", fontWeight: 600 }}
                  labelFormatter={formatDateBR}
                  formatter={(value: number) => [`${value} reuniã${value === 1 ? "o" : "es"}`, "Marcadas"]}
                />
                <Bar dataKey="amount" fill="#FF640F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

// Próxima data (>= hoje) em que cai algum dos dias de vencimento informados,
// tratando meses mais curtos (ex.: dia 31 em fevereiro cai no último dia).
function nextBillingDate(days: number[]): Date | null {
  if (days.length === 0) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let best: Date | null = null;
  for (const day of days) {
    for (let add = 0; add < 13; add++) {
      const mm = now.getMonth() + add;
      const year = now.getFullYear() + Math.floor(mm / 12);
      const month = ((mm % 12) + 12) % 12;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const d = new Date(year, month, Math.min(day, daysInMonth));
      if (d >= today) {
        if (!best || d < best) best = d;
        break;
      }
    }
  }
  return best;
}

function SubscriptionsCard() {
  const [items, setItems] = useState<SubscriptionDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextDue = useMemo(
    () =>
      nextBillingDate(
        (items ?? [])
          .map((s) => s.billingDay)
          .filter((d): d is number => d != null)
      ),
    [items]
  );

  useEffect(() => {
    fetch("/api/subscriptions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: SubscriptionDTO[]) => setItems(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of items ?? []) m.set(s.currency, (m.get(s.currency) ?? 0) + s.monthly);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <section className="overflow-hidden rounded-2xl border border-psa-line bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-psa-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-psa-blue-soft text-psa-blue">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-psa-ink">Assinaturas de usuários</h3>
            <p className="text-xs text-psa-muted">
              Custo de assentos (ChatGPT Team, Claude Team…) · cadastro manual, não vem de API
            </p>
          </div>
        </div>
        <a
          href="/assinaturas"
          className="inline-flex items-center gap-1.5 rounded-full border border-psa-line px-3 py-1.5 text-xs font-medium text-psa-ink transition hover:border-psa-orange hover:text-psa-orange"
        >
          Gerenciar
        </a>
      </header>

      <div className="px-6 py-5">
        {error ? (
          <p className="text-sm text-red-600">Erro ao carregar assinaturas: {error}</p>
        ) : items === null ? (
          <p className="text-sm text-psa-muted">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-psa-muted">
            Nenhuma assinatura cadastrada.{" "}
            <a href="/assinaturas" className="font-medium text-psa-orange hover:underline">
              Adicionar a primeira →
            </a>
          </p>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">
                Total mensal
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                {totalsByCurrency.map(([cur, total]) => (
                  <span key={cur} className="text-2xl font-semibold tabular-nums text-psa-orange">
                    {formatMoney(total, cur)}
                    <span className="ml-1 text-xs font-normal text-psa-muted">/mês</span>
                  </span>
                ))}
              </div>
              {nextDue && (
                <p className="mt-2 text-xs text-psa-muted">
                  Próximo vencimento:{" "}
                  <span className="font-medium text-psa-ink">
                    {nextDue.toLocaleDateString("pt-BR")}
                  </span>
                </p>
              )}
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5 sm:max-w-md">
              {items.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 truncate text-psa-ink">
                    {s.tool}
                    {s.team && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-psa-blue-soft px-2 py-0.5 text-[10px] font-medium text-psa-blue">
                        {s.team}
                      </span>
                    )}
                    <span className="text-xs text-psa-muted">
                      {s.seats} × {formatMoney(s.costPerSeat, s.currency)}
                      {s.billingDay != null ? ` · vence dia ${s.billingDay}` : ""}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-medium tabular-nums text-psa-ink">
                    {formatMoney(s.monthly, s.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  currency,
  raw,
  highlight,
  accent,
}: {
  label: string;
  value?: number | null;
  currency?: string;
  raw?: string;
  highlight?: boolean;
  accent?: string;
}) {
  const display =
    raw !== undefined
      ? raw
      : value == null || currency == null
        ? "—"
        : formatMoney(value, currency);
  return (
    <div className="flex h-full flex-col bg-white px-3 py-4">
      <div className="text-[10px] font-semibold uppercase leading-snug tracking-[0.14em] text-psa-muted">
        {label}
      </div>
      <div
        className="mt-auto whitespace-nowrap pt-2 text-base font-semibold leading-tight tracking-tight tabular-nums sm:text-lg"
        style={{ color: highlight && accent ? accent : "#0B1320" }}
      >
        {display}
      </div>
    </div>
  );
}

function PsaLogo() {
  return (
    <div className="flex items-center" aria-label="PSA">
      <span className="font-display text-2xl font-extrabold tracking-tight text-psa-ink">
        PSA
      </span>
      <span className="ml-0.5 text-2xl font-extrabold leading-none text-psa-orange">!</span>
    </div>
  );
}
