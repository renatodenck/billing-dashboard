"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw } from "lucide-react";
import type { DashboardPayload } from "./api/data/route";
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
  meta: { label: "Meta Ads", accent: "#053CAA", soft: "#E1E9FF", caption: "Mídia paga" },
} as const;

type SourceKey = keyof typeof SOURCE_META;

const PRESET_ORDER: RangePreset[] = [
  "today",
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
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-psa-line bg-white px-4 py-1.5 text-sm font-medium text-psa-ink transition hover:border-psa-orange hover:text-psa-orange disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
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

        <div className="grid gap-6 md:grid-cols-2">
          {(Object.keys(SOURCE_META) as SourceKey[]).map((key) => (
            <SourceCard key={key} source={key} data={data} range={range} />
          ))}
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
        {source === "meta" ? (
          <Stat label="Saldo atual" value={summary?.balance} currency={currency} />
        ) : (
          <Stat label="Moeda" raw={currency} />
        )}
      </div>

      <div className="px-4 pb-5 pt-4">
        <div className="h-44">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-psa-muted">
              {dailyAll.length === 0
                ? "Sem dados ainda — aguarde o primeiro snapshot."
                : "Sem registros no período selecionado."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filtered} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${source}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={meta.accent} stopOpacity={0} />
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
                  formatter={(value: number) => [formatMoney(value, currency), "Gasto"]}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke={meta.accent}
                  strokeWidth={2.5}
                  fill={`url(#grad-${source})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
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
    <div className="bg-white px-4 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">
        {label}
      </div>
      <div
        className="mt-1 text-xl font-semibold tabular-nums"
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
