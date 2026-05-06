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

const SOURCE_META = {
  openai: { label: "OpenAI", color: "#10a37f" },
  meta: { label: "Meta Ads", color: "#1877f2" },
} as const;

type SourceKey = keyof typeof SOURCE_META;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Snapshots automáticos às 08:00, 12:00 e 16:00 (Brasília).
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          Erro ao carregar dados: {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {(Object.keys(SOURCE_META) as SourceKey[]).map((key) => (
          <SourceCard key={key} source={key} data={data} />
        ))}
      </div>
    </main>
  );
}

function SourceCard({
  source,
  data,
}: {
  source: SourceKey;
  data: DashboardPayload | null;
}) {
  const meta = SOURCE_META[source];
  const summary = data?.sources[source];
  const daily = data?.daily[source] ?? [];

  const chartData = useMemo(
    () => daily.slice(-30).map((d) => ({ day: d.day, amount: d.amount })),
    [daily]
  );

  const currency = summary?.currency ?? "USD";
  const updatedAt = summary?.capturedAt ? new Date(summary.capturedAt) : null;
  const updatedLabel = updatedAt
    ? updatedAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

  return (
    <section className="rounded-lg border border-border bg-panel p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: meta.color }}
          />
          <h2 className="text-lg font-medium">{meta.label}</h2>
          {summary?.accountName && (
            <span className="text-xs text-zinc-500">· {summary.accountName}</span>
          )}
        </div>
        <span className="text-xs text-zinc-500">{updatedLabel}</span>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Hoje" value={summary?.spentToday} currency={currency} />
        <Stat label="Mês atual" value={summary?.spentMonth} currency={currency} />
        <Stat label="Acumulado" value={summary?.totalSpent} currency={currency} />
        {source === "meta" ? (
          <Stat label="Saldo" value={summary?.balance} currency={currency} />
        ) : (
          <Stat label="Moeda" value={null} currency={currency} raw={currency} />
        )}
      </div>

      <div className="h-44">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Sem dados ainda — aguarde o primeiro snapshot.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${source}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={meta.color} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f1f24" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={formatDateBR}
                stroke="#52525b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#52525b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
                }
              />
              <Tooltip
                contentStyle={{
                  background: "#111114",
                  border: "1px solid #1f1f24",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={formatDateBR}
                formatter={(value: number) => [formatMoney(value, currency), "Gasto"]}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke={meta.color}
                strokeWidth={2}
                fill={`url(#grad-${source})`}
              />
            </AreaChart>
          </ResponsiveContainer>
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
}: {
  label: string;
  value: number | null | undefined;
  currency: string;
  raw?: string;
}) {
  const display =
    raw !== undefined ? raw : value == null ? "—" : formatMoney(value, currency);
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{display}</div>
    </div>
  );
}
