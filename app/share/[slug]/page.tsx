"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExternalLink, RefreshCw } from "lucide-react";
import { formatDateBR, formatMoney } from "@/lib/format";
import { PRESET_LABELS, presetToRange, type DateRange, type RangePreset } from "@/lib/dateRange";
import type { TemplateAnalytics, TemplateSummary } from "@/lib/metaTemplates";
import type { DealsFunnel } from "@/lib/hubspotDeals";

// 50 Palestras / The Best Speaker brand palette (from the landing page).
const C = {
  bg: "#0d0d0f",
  bgAlt: "#141416",
  card: "#1c1c20",
  card2: "#222227",
  yellow: "#ffcc00",
  red: "#e8312a",
  text: "#f2f2f2",
  muted: "#9a9a9f",
  line: "#2a2a2f",
};

const SERIES = [
  { key: "sent", label: "Enviadas", color: "#f87171" },
  { key: "delivered", label: "Entregues", color: "#a78bfa" },
  { key: "read", label: "Lidas", color: "#2dd4bf" },
  { key: "responses", label: "Respostas únicas", color: "#34d399" },
] as const;

const PRESET_ORDER: RangePreset[] = ["today", "yesterday", "7d", "30d", "60d", "custom"];

// Deals stacked-chart series.
const DEAL_SERIES = [
  { key: "closed", label: "Finalizou a compra", color: "#22c55e" },
  { key: "abandoned", label: "Abandonou o carrinho", color: "#f59e0b" },
  { key: "waiting", label: "Aguardando pagamento", color: "#8b87a8" },
] as const;

type TabKey = "whatsapp" | "negocios";

type Payload = {
  title: string;
  subtitle: string;
  template: TemplateSummary;
  analytics: TemplateAnalytics;
  deals: DealsFunnel | null;
  dealsError: string | null;
};

export default function SharePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("7d");
  const [tab, setTab] = useState<TabKey>("whatsapp");
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { since: today, until: today };
  });

  const range = presetToRange(preset, customRange, []);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ since: range.since, until: range.until });
      const res = await fetch(`/api/public/${slug}?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json as Payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slug, range.since, range.until]);

  useEffect(() => {
    load();
  }, [load]);

  const a = data?.analytics;
  const t = a?.totals;
  const currency = a?.currency ?? "USD";

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      {/* Top bar */}
      <div className="border-b" style={{ borderColor: C.line, background: C.bg }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div
            className="flex items-center gap-1 text-[13px] font-extrabold uppercase"
            style={{ letterSpacing: "3px" }}
          >
            <span>The Best Speaker</span>
            <span style={{ color: C.red }}>•</span>
            <span>Brasil</span>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition disabled:opacity-60"
            style={{ background: C.yellow, color: "#1a1500" }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Hero */}
      <div
        className="relative overflow-hidden border-b"
        style={{
          borderColor: C.line,
          background: `radial-gradient(80% 120% at 15% 0%, rgba(255,204,0,.10) 0%, ${C.bg} 55%)`,
        }}
      >
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div
            className="mb-3 inline-flex items-center gap-2 text-[12px] font-bold uppercase"
            style={{ color: C.yellow, letterSpacing: "2px" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ background: C.yellow }}
            />
            Desempenho da campanha · tempo real
          </div>
          <h1
            className="max-w-2xl text-3xl font-extrabold uppercase sm:text-5xl"
            style={{ lineHeight: 1.05, letterSpacing: "-0.5px" }}
          >
            {data?.title ?? "Carregando…"}
          </h1>
          <p className="mt-3 text-sm" style={{ color: C.muted }}>
            {data?.subtitle ?? "WhatsApp"}
          </p>
        </div>
      </div>

      {/* Abas */}
      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.bg }}>
        <div className="mx-auto flex max-w-5xl gap-1 px-6">
          {([
            { key: "whatsapp", label: "WhatsApp" },
            { key: "negocios", label: "Negócios" },
          ] as const).map((tb) => {
            const active = tab === tb.key;
            return (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className="-mb-px border-b-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition"
                style={{
                  borderColor: active ? C.yellow : "transparent",
                  color: active ? C.text : C.muted,
                }}
              >
                {tb.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Filtros de período */}
        <div
          className="mb-6 rounded-2xl p-4"
          style={{ background: C.card, border: `1px solid ${C.line}` }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_ORDER.map((p) => {
              const active = preset === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition"
                  style={
                    active
                      ? { background: C.yellow, color: "#1a1500" }
                      : { color: C.muted, border: `1px solid ${C.line}` }
                  }
                >
                  {PRESET_LABELS[p]}
                </button>
              );
            })}
          </div>

          {preset === "custom" && (
            <div
              className="mt-4 flex flex-wrap items-end gap-3 pt-4"
              style={{ borderTop: `1px solid ${C.line}` }}
            >
              <DateField
                label="De"
                value={customRange.since}
                max={customRange.until}
                onChange={(v) => setCustomRange((r) => ({ ...r, since: v }))}
              />
              <DateField
                label="Até"
                value={customRange.until}
                min={customRange.since}
                onChange={(v) => setCustomRange((r) => ({ ...r, until: v }))}
              />
            </div>
          )}
        </div>

        {error && (
          <div
            className="mb-6 rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(232,49,42,.12)", border: `1px solid ${C.red}`, color: "#ffb3b0" }}
          >
            {error}
          </div>
        )}

        {tab === "negocios" ? (
          <DealsView deals={data?.deals ?? null} error={data?.dealsError ?? null} loading={loading} />
        ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <TemplatePreviewCard template={data?.template ?? null} />

          <div className="space-y-6">
            {/* Cost cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <BigStat label="Valor usado" value={t ? formatMoney(t.amountSpent, currency) : "—"} loading={loading} highlight />
              <BigStat
                label="Custo por mensagem entregue"
                value={a?.costPerDelivered != null ? formatMoney(a.costPerDelivered, currency) : "—"}
                loading={loading}
              />
              <BigStat
                label="Custo por clique no botão"
                value={a?.costPerUrlClick != null ? formatMoney(a.costPerUrlClick, currency) : "—"}
                loading={loading}
              />
            </div>

            {/* Performance */}
            <section
              className="overflow-hidden rounded-2xl"
              style={{ background: C.card, border: `1px solid ${C.line}` }}
            >
              <header className="px-6 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
                <div className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: C.yellow }}>
                  Desempenho
                </div>
              </header>

              <div className="grid grid-cols-2 sm:grid-cols-4" style={{ background: C.line, gap: "1px" }}>
                <MetricCell label="Mensagens enviadas" value={t?.sent ?? null} />
                <MetricCell label="Mensagens entregues" value={t?.delivered ?? null} />
                <MetricCell
                  label="Mensagens lidas"
                  value={t?.read ?? null}
                  hint={a?.readRate != null ? `${(a.readRate * 100).toFixed(0)}%` : undefined}
                />
                <MetricCell label="Respostas únicas" value={t?.uniqueResponses ?? null} />
              </div>

              <div className="px-4 pb-6 pt-5" style={{ background: C.card }}>
                <TrendChart daily={a?.daily ?? []} loading={loading} />
              </div>
            </section>

            {/* Cliques no botão */}
            <ButtonClicksCard buttons={a?.buttons ?? []} delivered={t?.delivered ?? 0} />
          </div>
        </div>
        )}

        <footer className="mt-12 pt-6 text-center text-xs" style={{ borderTop: `1px solid ${C.line}`, color: C.muted }}>
          The Best Speaker Brasil · Profissionais SA
        </footer>
      </main>
    </div>
  );
}

function DealsView({
  deals,
  error,
  loading,
}: {
  deals: DealsFunnel | null;
  error: string | null;
  loading: boolean;
}) {
  if (error) {
    return (
      <div
        className="rounded-xl px-4 py-3 text-sm"
        style={{ background: "rgba(232,49,42,.12)", border: `1px solid ${C.red}`, color: "#ffb3b0" }}
      >
        Erro ao carregar negócios: {error}
      </div>
    );
  }
  if (loading && !deals) {
    return (
      <div className="flex h-64 items-center justify-center text-sm" style={{ color: C.muted }}>
        Carregando…
      </div>
    );
  }
  const t = deals?.totals;
  const rate = deals?.conclusionRate;

  return (
    <div className="space-y-6">
      {/* Header + taxa de conclusão */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: C.yellow }}>
            Funil de compra
          </div>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>
            pipeline The Best School · B2C (1 pedido = 1 negócio)
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-[1.5px]" style={{ color: C.muted }}>
            Taxa de conclusão
          </div>
          <div className="text-3xl font-extrabold tabular-nums" style={{ color: "#f59e0b" }}>
            {rate != null ? `${(rate * 100).toFixed(0)}%` : "—"}
          </div>
        </div>
      </div>

      {/* Cards do funil */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FunnelCard label="Negócios fechados" value={t ? t.closed.toLocaleString("pt-BR") : "—"} hint="etapa = Negócio fechado" color="#22c55e" />
        <FunnelCard
          label="Valor vendido (fechados)"
          value={t ? formatMoney(t.revenue, "BRL") : "—"}
          hint="soma dos negócios fechados"
          color="#22c55e"
        />
        <FunnelCard label="Abandonaram o carrinho" value={t ? t.abandoned.toLocaleString("pt-BR") : "—"} hint="etapa = Abandonou carrinho" color="#f59e0b" />
        <FunnelCard label="Aguardando pagamento" value={t ? t.waiting.toLocaleString("pt-BR") : "—"} hint="etapa = Aguardando pagamento" color="#a78bfa" />
      </div>

      {/* Vendas por dia (empilhado) */}
      <ChartCard title="Vendas por dia · negócios criados · horário de Brasília">
        {!deals || deals.dailySales.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deals.dailySales} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={C.line} vertical={false} />
              <XAxis dataKey="day" tickFormatter={formatDateBR} stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: C.card2, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: C.text, fontWeight: 600 }}
                itemStyle={{ color: C.text }}
                labelFormatter={formatDateBR}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
              {DEAL_SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="d" fill={s.color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Faturamento por dia */}
      <ChartCard
        title="Faturamento por dia · vendas fechadas"
        right={deals ? `Total ${formatMoney(deals.totals.revenue, "BRL")}` : undefined}
      >
        {!deals || deals.dailyRevenue.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deals.dailyRevenue} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke={C.line} vertical={false} />
              <XAxis dataKey="day" tickFormatter={formatDateBR} stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis
                stroke={C.muted}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
              />
              <Tooltip
                contentStyle={{ background: C.card2, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: C.text, fontWeight: 600 }}
                labelFormatter={formatDateBR}
                formatter={(v: number) => [formatMoney(v, "BRL"), "Faturamento"]}
              />
              <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function FunnelCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl px-5 py-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="mt-2 text-[11px]" style={{ color: C.muted }}>
        {hint}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: C.muted }}>
          {title}
        </div>
        {right && (
          <div className="text-sm font-extrabold tabular-nums" style={{ color: "#22c55e" }}>
            {right}
          </div>
        )}
      </header>
      <div className="px-4 pb-6 pt-5">
        <div className="h-64">{children}</div>
      </div>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm" style={{ color: C.muted }}>
      Sem negócios no período.
    </div>
  );
}

function ButtonClicksCard({
  buttons,
  delivered,
}: {
  buttons: TemplateAnalytics["buttons"];
  delivered: number;
}) {
  if (!buttons || buttons.length === 0) return null;

  const typeLabel = (kind: string) =>
    kind === "url" ? "Clique no site" : kind === "quick_reply" ? "Resposta rápida" : "Botão";

  return (
    <section
      className="overflow-hidden rounded-2xl"
      style={{ background: C.card, border: `1px solid ${C.line}` }}
    >
      <header className="px-6 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: C.yellow }}>
          Cliques no botão
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ color: C.muted }} className="text-[11px] uppercase tracking-wide">
              <th className="px-6 py-3 font-semibold">Rótulo</th>
              <th className="px-6 py-3 font-semibold">Tipo</th>
              <th className="px-6 py-3 text-right font-semibold">Total de cliques</th>
              <th className="px-6 py-3 text-right font-semibold">Taxa de cliques</th>
            </tr>
          </thead>
          <tbody>
            {buttons.map((b, i) => {
              const rate = delivered > 0 ? (b.totalClicks / delivered) * 100 : null;
              return (
                <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-6 py-3 font-medium" style={{ color: C.text }}>
                    {b.label}
                  </td>
                  <td className="px-6 py-3" style={{ color: C.muted }}>
                    {typeLabel(b.kind)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums" style={{ color: C.text }}>
                    {b.totalClicks.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-6 py-3 text-right font-semibold tabular-nums" style={{ color: C.yellow }}>
                    {rate != null ? `${rate.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[1.5px]" style={{ color: C.muted }}>
        {label}
      </label>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-md px-3 py-1.5 text-sm outline-none"
        style={{
          background: C.card2,
          border: `1px solid ${C.line}`,
          color: C.text,
          colorScheme: "dark",
        }}
      />
    </div>
  );
}

function TemplatePreviewCard({ template }: { template: TemplateSummary | null }) {
  return (
    <aside
      className="self-start rounded-2xl p-5"
      style={{ background: C.card, border: `1px solid ${C.line}` }}
    >
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[2px]" style={{ color: C.yellow }}>
        Modelo enviado
      </div>
      <div className="overflow-hidden rounded-xl bg-[#ECE5DD] p-3">
        <div className="rounded-lg bg-white p-2 shadow-sm">
          {template?.preview.headerImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={template.preview.headerImageUrl}
              alt="Cabeçalho do modelo"
              className="mb-2 aspect-video w-full rounded-md object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="mb-2 flex aspect-video w-full items-center justify-center rounded-md bg-[#1c1c20] text-xs font-semibold uppercase tracking-wider text-white">
              {template ? "Imagem do cabeçalho" : "—"}
            </div>
          )}
          <p className="whitespace-pre-line text-[13px] leading-snug text-[#111]">
            {template?.preview.bodyText ?? "Carregando…"}
          </p>
          {template?.preview.footerText && (
            <p className="mt-1 text-[11px] text-[#667781]">{template.preview.footerText}</p>
          )}
        </div>
        {template?.preview.buttons.map((b, i) => (
          <div
            key={i}
            className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-[13px] font-medium text-[#00A5F4] shadow-sm"
          >
            {b.url && <ExternalLink className="h-3.5 w-3.5" />}
            {b.text}
          </div>
        ))}
      </div>
    </aside>
  );
}

function BigStat({
  label,
  value,
  loading,
  highlight,
}: {
  label: string;
  value: string;
  loading: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl px-5 py-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <p className="text-xs" style={{ color: C.muted }}>
        {label}
      </p>
      <p
        className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums"
        style={{ color: highlight ? C.yellow : C.text }}
      >
        {loading ? "…" : value}
      </p>
    </div>
  );
}

function MetricCell({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className="px-4 py-4" style={{ background: C.card }}>
      <p className="text-[11px]" style={{ color: C.muted }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold tabular-nums" style={{ color: C.yellow }}>
        {value == null ? "—" : value.toLocaleString("pt-BR")}
        {hint && (
          <span className="ml-1.5 text-sm font-normal" style={{ color: C.muted }}>
            ({hint})
          </span>
        )}
      </p>
    </div>
  );
}

function TrendChart({ daily, loading }: { daily: TemplateAnalytics["daily"]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm" style={{ color: C.muted }}>
        Carregando…
      </div>
    );
  }
  if (daily.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm" style={{ color: C.muted }}>
        Sem dados no período.
      </div>
    );
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={daily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={C.line} vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDateBR}
            stroke={C.muted}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: C.card2,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: C.text, fontWeight: 600 }}
            itemStyle={{ color: C.text }}
            labelFormatter={formatDateBR}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} iconType="plainline" />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.25}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
