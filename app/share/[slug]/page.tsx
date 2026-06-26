"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import type { ClarityInsights, SmartEvent } from "@/lib/clarity";

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

type TabKey = "geral" | "whatsapp" | "negocios" | "pagina";

type Payload = {
  title: string;
  subtitle: string;
  template: TemplateSummary;
  analytics: TemplateAnalytics;
  deals: DealsFunnel | null;
  dealsError: string | null;
  page: ClarityInsights | null;
  pageError: string | null;
  clarityProjectId: string | null;
  usdToBrl: number;
};

export default function SharePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gated, setGated] = useState(false);
  const [preset, setPreset] = useState<RangePreset>("7d");
  const [tab, setTab] = useState<TabKey>("geral");
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
      const key = new URLSearchParams(window.location.search).get("key");
      if (key) params.set("key", key);
      const res = await fetch(`/api/public/${slug}?${params}`, { cache: "no-store" });
      if (res.status === 401) {
        setGated(true);
        setData(null);
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setGated(false);
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

  if (gated) {
    return <ShareLogin onSuccess={load} />;
  }

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
            { key: "geral", label: "Visão Geral" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "negocios", label: "Negócios" },
            { key: "pagina", label: "Página" },
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

        {tab === "geral" ? (
          <OverviewView data={data} loading={loading} />
        ) : tab === "negocios" ? (
          <DealsView deals={data?.deals ?? null} error={data?.dealsError ?? null} loading={loading} />
        ) : tab === "pagina" ? (
          <ClarityView
            slug={slug ?? ""}
            page={data?.page ?? null}
            error={data?.pageError ?? null}
            projectId={data?.clarityProjectId ?? null}
            loading={loading}
          />
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

function ShareLogin({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/share-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Não foi possível entrar.");
      }
      onSuccess();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: C.bg, color: C.text }}>
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl p-7"
        style={{ background: C.card, border: `1px solid ${C.line}` }}
      >
        <div
          className="flex items-center gap-1 text-[12px] font-extrabold uppercase"
          style={{ letterSpacing: "3px" }}
        >
          <span>The Best Speaker</span>
          <span style={{ color: C.red }}>•</span>
          <span>Brasil</span>
        </div>
        <h1 className="mt-4 text-xl font-extrabold">Acesso ao painel</h1>
        <p className="mt-1 text-sm" style={{ color: C.muted }}>
          Informe o login e a senha para visualizar.
        </p>

        <label className="mt-5 block text-[10px] font-bold uppercase tracking-[1.5px]" style={{ color: C.muted }}>
          Login
        </label>
        <input
          type="text"
          value={user}
          autoComplete="username"
          onChange={(e) => setUser(e.target.value)}
          className="mt-1 w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text }}
        />

        <label className="mt-4 block text-[10px] font-bold uppercase tracking-[1.5px]" style={{ color: C.muted }}>
          Senha
        </label>
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text }}
        />

        {err && (
          <p className="mt-3 text-sm" style={{ color: "#ffb3b0" }}>
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-md py-2.5 text-sm font-extrabold uppercase tracking-wide transition disabled:opacity-60"
          style={{ background: C.yellow, color: "#1a1500" }}
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

type HeatPoint = { x: number; y: number; w: number };
type HeatmapData = { device: string; total: number; max: number; points: HeatPoint[] };

function OverviewView({ data, loading }: { data: Payload | null; loading: boolean }) {
  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm" style={{ color: C.muted }}>
        Carregando…
      </div>
    );
  }

  const a = data?.analytics;
  const deals = data?.deals;
  const page = data?.page;
  const fx = data?.usdToBrl ?? 5;

  // WhatsApp cost is in the account currency (USD for this WABA) → convert to BRL.
  const costNative = a?.totals.amountSpent ?? 0;
  const costBRL = a?.currency === "BRL" ? costNative : costNative * fx;

  const revenue = deals?.totals.revenue ?? 0; // BRL
  const sales = deals?.totals.closed ?? 0;
  const ticket = sales > 0 ? revenue / sales : null;
  const cac = sales > 0 ? costBRL / sales : null;
  const roas = costBRL > 0 ? revenue / costBRL : null;
  const result = revenue - costBRL;

  const delivered = a?.totals.delivered ?? 0;
  const clicks = a?.totals.urlButtonClicks ?? 0;
  const visits = page?.uniqueUsers ?? null;

  const brl = (n: number) => formatMoney(n, "BRL");
  const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—");

  const funnel = [
    { label: "Mensagens entregues", value: delivered, color: "#a78bfa", note: "WhatsApp" },
    { label: "Cliques no link", value: clicks, color: "#2dd4bf", note: pct(clicks, delivered) + " das entregues" },
    { label: "Vendas", value: sales, color: "#22c55e", note: pct(sales, clicks) + " dos cliques" },
  ];
  const topFunnel = Math.max(delivered, 1);

  return (
    <div className="space-y-6">
      {/* KPIs de dinheiro */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FunnelCard label="Receita" value={brl(revenue)} hint="vendas fechadas" color="#22c55e" />
        <FunnelCard label="Vendas" value={sales.toLocaleString("pt-BR")} hint="negócios fechados" color={C.text} />
        <FunnelCard label="Ticket médio" value={ticket != null ? brl(ticket) : "—"} hint="receita ÷ vendas" color={C.text} />
        <FunnelCard
          label="ROAS"
          value={roas != null ? `${roas.toFixed(1)}×` : "—"}
          hint="receita ÷ custo de mídia"
          color={roas == null ? C.text : roas >= 1 ? "#22c55e" : C.red}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FunnelCard label="Custo de mídia (WhatsApp)" value={brl(costBRL)} hint={a?.currency === "BRL" ? "" : `US$ ${costNative.toFixed(2)} · câmbio ${fx.toFixed(2)}`} color="#f59e0b" />
        <FunnelCard label="CAC" value={cac != null ? brl(cac) : "—"} hint="custo ÷ vendas" color={C.text} />
        <FunnelCard
          label="Resultado (receita − mídia)"
          value={brl(result)}
          hint="antes de taxas/produto"
          color={result >= 0 ? "#22c55e" : C.red}
        />
        <FunnelCard label="Visitas na landing" value={visits != null ? visits.toLocaleString("pt-BR") : "—"} hint="Clarity · últimos 3 dias" color={C.text} />
      </div>

      {/* Funil ponta a ponta */}
      <section className="overflow-hidden rounded-2xl" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <header className="px-6 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: C.yellow }}>
            Funil ponta a ponta
          </div>
        </header>
        <div className="space-y-4 p-6">
          {funnel.map((s) => {
            const width = (s.value / topFunnel) * 100;
            return (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium" style={{ color: C.text }}>{s.label}</span>
                  <span className="tabular-nums" style={{ color: C.muted }}>
                    {s.value.toLocaleString("pt-BR")} <span className="ml-1">· {s.note}</span>
                  </span>
                </div>
                <div className="h-7 w-full overflow-hidden rounded-md" style={{ background: "rgba(154,154,159,.15)" }}>
                  <div className="h-full rounded-md transition-all" style={{ width: `${Math.max(width, 2)}%`, background: s.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-[11px]" style={{ color: C.muted }}>
        ⚠️ Custo (WhatsApp) e vendas (HubSpot) seguem o período selecionado; <strong>visitas</strong> vêm
        do Clarity (últimos 3 dias). Custo convertido de US$ para R$ ao câmbio {fx.toFixed(2)}. Resultado é
        receita menos custo de mídia (não inclui taxas do Kiwify nem custo do produto).
      </p>
    </div>
  );
}

function ClarityView({
  slug,
  page,
  error,
  projectId,
  loading,
}: {
  slug: string;
  page: ClarityInsights | null;
  error: string | null;
  projectId: string | null;
  loading: boolean;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [heat, setHeat] = useState<HeatmapData | null>(null);
  const [heatLoading, setHeatLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setHeatLoading(true);
    const key = new URLSearchParams(window.location.search).get("key");
    const qs = `device=${device}${key ? `&key=${encodeURIComponent(key)}` : ""}`;
    fetch(`/api/public/${slug}/heatmap?${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active) setHeat(j);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHeatLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, device]);
  if (loading && !page && !error) {
    return (
      <div className="flex h-64 items-center justify-center text-sm" style={{ color: C.muted }}>
        Carregando…
      </div>
    );
  }

  const heatmapUrl = projectId
    ? `https://clarity.microsoft.com/projects/view/${projectId}/heatmaps`
    : null;
  const fmtInt = (n: number) => n.toLocaleString("pt-BR");
  const fmtPct = (n: number | null) => (n == null ? "—" : `${n.toFixed(0)}%`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: C.yellow }}>
            Landing page · Microsoft Clarity
          </div>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>
            lps.profissionaissa.com/50palestras · últimos {page?.numOfDays ?? 3} dias
          </p>
        </div>
        {heatmapUrl && (
          <a
            href={heatmapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide"
            style={{ background: C.yellow, color: "#1a1500" }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver mapa de calor
          </a>
        )}
      </div>

      {error && !page ? (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(154,154,159,.10)", border: `1px solid ${C.line}`, color: C.muted }}
        >
          Métricas do Clarity indisponíveis no momento{/Exceeded daily limit|429/i.test(error) ? " (limite diário da API atingido — volta a atualizar amanhã)" : ""}. O mapa de calor abaixo segue funcionando.
        </div>
      ) : (
        <>
          {/* Métricas principais */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FunnelCard label="Visitas únicas" value={page ? fmtInt(page.uniqueUsers) : "—"} hint="usuários distintos" color="#22c55e" />
            <FunnelCard label="Sessões" value={page ? fmtInt(page.sessions) : "—"} hint={page ? `${fmtInt(page.bots)} de bots` : ""} color={C.text} />
            <FunnelCard label="Páginas / sessão" value={page?.pagesPerSession != null ? page.pagesPerSession.toFixed(1) : "—"} hint="navegação por visita" color={C.text} />
            <FunnelCard label="Scroll médio" value={fmtPct(page?.avgScrollDepth ?? null)} hint="profundidade da página" color="#2dd4bf" />
          </div>

          {/* Insights (smart events do Clarity) */}
          <section className="overflow-hidden rounded-2xl" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <header className="px-6 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: C.muted }}>
                Insights · cliques e engajamento
              </div>
            </header>
            <div className="grid grid-cols-2 sm:grid-cols-3" style={{ background: C.line, gap: "1px" }}>
              <InsightCard label="Cliques contínuos" event={page?.rageClicks} sessions={page?.sessions ?? 0} />
              <InsightCard label="Cliques mortos" event={page?.deadClicks} sessions={page?.sessions ?? 0} />
              <InsightCard label="Rolagem excessiva" event={page?.excessiveScroll} sessions={page?.sessions ?? 0} />
              <InsightCard label="Voltas rápidas" event={page?.quickbackClicks} sessions={page?.sessions ?? 0} />
              <InsightCard label="Cliques com erro" event={page?.errorClicks} sessions={page?.sessions ?? 0} />
              <div className="px-4 py-4" style={{ background: C.card }}>
                <p className="text-[11px]" style={{ color: C.muted }}>Tempo ativo</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums" style={{ color: C.text }}>
                  {page?.activeTimeMin != null ? `${page.activeTimeMin.toFixed(1)} min` : "—"}
                </p>
              </div>
            </div>
          </section>

          {/* Por dispositivo */}
          <section className="overflow-hidden rounded-2xl" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <header className="px-6 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: C.muted }}>
                Por dispositivo
              </div>
            </header>
            <div className="space-y-3 p-5">
              {page && page.devices.length > 0 ? (
                page.devices.map((d) => {
                  const pct = page.sessions > 0 ? (d.sessions / page.sessions) * 100 : 0;
                  return (
                    <div key={d.device}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium" style={{ color: C.text }}>
                          {d.device}
                        </span>
                        <span className="tabular-nums" style={{ color: C.muted }}>
                          {d.sessions.toLocaleString("pt-BR")} sess. · {d.users.toLocaleString("pt-BR")} únicos · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-md" style={{ background: "rgba(154,154,159,.18)" }}>
                        <div className="h-full rounded-md" style={{ width: `${Math.max(pct, 2)}%`, background: C.yellow }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm" style={{ color: C.muted }}>
                  Sem dados por dispositivo ainda.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Mapa de calor próprio (embutido) */}
      <section className="overflow-hidden rounded-2xl" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-[11px] font-bold uppercase tracking-[2px]" style={{ color: C.yellow }}>
            Mapa de calor de cliques
            {heat ? <span className="ml-2 font-normal" style={{ color: C.muted }}>· {heat.total} cliques</span> : null}
          </div>
          <div className="flex items-center gap-1">
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition"
                style={device === d ? { background: C.yellow, color: "#1a1500" } : { color: C.muted, border: `1px solid ${C.line}` }}
              >
                {d === "desktop" ? "Desktop" : "Mobile"}
              </button>
            ))}
          </div>
        </header>
        <div className="p-5">
          {heatLoading && !heat ? (
            <div className="flex h-40 items-center justify-center text-sm" style={{ color: C.muted }}>
              Carregando…
            </div>
          ) : heat && heat.total === 0 ? (
            <div className="flex h-40 items-center justify-center text-center text-sm" style={{ color: C.muted }}>
              Ainda sem cliques registrados no {device}. Os cliques aparecem aqui conforme as visitas acontecem.
            </div>
          ) : (
            <div className="mx-auto" style={{ maxWidth: device === "mobile" ? 300 : 460 }}>
              <HeatmapCanvas
                src={`/heatmap/landing-${device}.png`}
                points={heat?.points ?? []}
                max={heat?.max ?? 1}
              />
            </div>
          )}
        </div>
      </section>

      <p className="text-[11px]" style={{ color: C.muted }}>
        ⚠️ Visitas/sessões vêm do Clarity (apenas os <strong>últimos 3 dias</strong>, agregado). O
        <strong> mapa de calor é nosso</strong>, montado a partir dos cliques reais na página
        (começou a contar a partir da instalação). O Clarity detalhado e as gravações ficam no painel
        do Clarity.
      </p>
    </div>
  );
}

const HEAT_RAMP: Array<[number, number, number]> = [
  [0, 0, 255],
  [0, 255, 255],
  [0, 255, 0],
  [255, 255, 0],
  [255, 0, 0],
];

function rampColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const seg = clamped * (HEAT_RAMP.length - 1);
  const i = Math.min(HEAT_RAMP.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = HEAT_RAMP[i];
  const b = HEAT_RAMP[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

function InsightCard({
  label,
  event,
  sessions,
}: {
  label: string;
  event: SmartEvent | undefined;
  sessions: number;
}) {
  const pct = event && sessions > 0 ? (event.sessions / sessions) * 100 : 0;
  return (
    <div className="px-4 py-4" style={{ background: C.card }}>
      <p className="text-[11px]" style={{ color: C.muted }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold tabular-nums" style={{ color: C.yellow }}>
        {event ? `${pct.toFixed(0)}%` : "—"}
      </p>
      <p className="text-[11px]" style={{ color: C.muted }}>
        {event ? `${event.sessions.toLocaleString("pt-BR")} sessões` : ""}
      </p>
    </div>
  );
}

function HeatmapCanvas({ src, points, max }: { src: string; points: HeatPoint[]; max: number }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const w = img.clientWidth;
    const h = img.clientHeight;
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!points.length) return;

    const radius = Math.max(10, w / 12);
    for (const p of points) {
      const intensity = Math.min(1, Math.sqrt(p.w / (max || 1)));
      const px = p.x * w;
      const py = p.y * h;
      const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
      g.addColorStop(0, `rgba(0,0,0,${intensity})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const alpha = d[i + 3];
      if (alpha === 0) continue;
      const [r, gg, bb] = rampColor(alpha / 255);
      d[i] = r;
      d[i + 1] = gg;
      d[i + 2] = bb;
      d[i + 3] = Math.min(205, alpha + 35);
    }
    ctx.putImageData(imgData, 0, 0);
  }, [points, max]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ border: `1px solid ${C.line}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt="Landing page" onLoad={draw} className="block w-full" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
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
