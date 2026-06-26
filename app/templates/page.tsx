"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, ExternalLink, RefreshCw, TrendingUp } from "lucide-react";
import { formatDateBR, formatMoney } from "@/lib/format";
import {
  PRESET_LABELS,
  presetToRange,
  type DateRange,
  type RangePreset,
} from "@/lib/dateRange";
import type { TemplateAnalytics, TemplateSummary } from "@/lib/metaTemplates";
import type { AccountOption } from "@/lib/metaAccounts";

const PRESET_ORDER: RangePreset[] = ["today", "yesterday", "7d", "30d", "60d", "custom"];

// Series colors mirror the WhatsApp Manager "Desempenho" chart.
const SERIES = [
  { key: "sent", label: "Mensagens enviadas", color: "#F87171" },
  { key: "delivered", label: "Mensagens entregues", color: "#7C3AED" },
  { key: "read", label: "Mensagens lidas", color: "#0D9488" },
  { key: "responses", label: "Respostas únicas", color: "#16A34A" },
] as const;

type TabKey = "trend" | "funnel";

export default function TemplatesPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [analytics, setAnalytics] = useState<TemplateAnalytics | null>(null);

  const [loadingList, setLoadingList] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  const [preset, setPreset] = useState<RangePreset>("7d");
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { since: today, until: today };
  });
  const [tab, setTab] = useState<TabKey>("trend");

  const range = useMemo(() => presetToRange(preset, customRange, []), [preset, customRange]);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  // Load the configured accounts once, then default to the first.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/accounts", { cache: "no-store" });
        const json = await res.json();
        if (!active) return;
        const list: AccountOption[] = json.accounts ?? [];
        setAccounts(list);
        setSelectedAccount(list[0]?.key ?? "");
        if (list.length === 0) setLoadingList(false);
      } catch (err) {
        if (active) {
          setListError(err instanceof Error ? err.message : String(err));
          setLoadingList(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Load templates whenever the selected account changes.
  useEffect(() => {
    if (!selectedAccount) return;
    let active = true;
    (async () => {
      setLoadingList(true);
      setListError(null);
      setTemplates([]);
      setSelectedId("");
      setAnalytics(null);
      try {
        const res = await fetch(`/api/templates?account=${encodeURIComponent(selectedAccount)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (!active) return;
        const list: TemplateSummary[] = json.templates ?? [];
        setTemplates(list);
        const preferred =
          list.find((t) => /palestra|^50_/i.test(t.name)) ??
          list.find((t) => t.status === "APPROVED") ??
          list[0];
        setSelectedId(preferred?.id ?? "");
      } catch (err) {
        if (active) setListError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoadingList(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedAccount]);

  const loadAnalytics = useCallback(async () => {
    if (!selectedId || !selectedAccount) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const params = new URLSearchParams({
        account: selectedAccount,
        templateId: selectedId,
        since: range.since,
        until: range.until,
      });
      const res = await fetch(`/api/templates/analytics?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setAnalytics(json as TemplateAnalytics);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : String(err));
      setAnalytics(null);
    } finally {
      setLoadingData(false);
    }
  }, [selectedAccount, selectedId, range.since, range.until]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const currency = analytics?.currency ?? "USD";
  const t = analytics?.totals;

  return (
    <div className="min-h-screen bg-psa-bg">
      <header className="border-b border-psa-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 text-psa-muted hover:text-psa-ink">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Painel</span>
            </a>
            <div className="hidden h-8 w-px bg-psa-line sm:block" />
            <div className="hidden sm:block">
              <h1 className="text-base font-semibold tracking-tight text-psa-ink">
                Analytics de Template
              </h1>
              <p className="text-xs text-psa-muted">WhatsApp · Profissionaissa</p>
            </div>
          </div>
          <button
            onClick={loadAnalytics}
            disabled={loadingData || !selectedId}
            className="inline-flex items-center gap-2 rounded-full border border-psa-line bg-white px-4 py-1.5 text-sm font-medium text-psa-ink transition hover:border-psa-orange hover:text-psa-orange disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Controls */}
        <div className="mb-6 rounded-2xl border border-psa-line bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px]">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">
                Conta (WhatsApp)
              </label>
              <select
                value={selectedAccount}
                disabled={accounts.length === 0}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="mt-1 w-full rounded-md border border-psa-line bg-white px-3 py-2 text-sm text-psa-ink focus:border-psa-orange focus:outline-none disabled:opacity-50"
              >
                {accounts.length === 0 && <option>—</option>}
                {accounts.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[260px] flex-1">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">
                Modelo de mensagem
              </label>
              <select
                value={selectedId}
                disabled={loadingList || templates.length === 0}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-1 w-full rounded-md border border-psa-line bg-white px-3 py-2 text-sm text-psa-ink focus:border-psa-orange focus:outline-none disabled:opacity-50"
              >
                {loadingList && <option>Carregando modelos…</option>}
                {!loadingList && templates.length === 0 && <option>Nenhum modelo encontrado</option>}
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} · {tpl.language} ({tpl.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_ORDER.map((p) => {
                const active = preset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreset(p)}
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
          </div>

          {preset === "custom" && (
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-psa-line pt-4">
              <DateInput
                label="De"
                value={customRange.since}
                max={customRange.until}
                onChange={(v) => setCustomRange((r) => ({ ...r, since: v }))}
              />
              <DateInput
                label="Até"
                value={customRange.until}
                min={customRange.since}
                onChange={(v) => setCustomRange((r) => ({ ...r, until: v }))}
              />
            </div>
          )}

          <p className="mt-3 text-[11px] text-psa-muted">
            ⚠️ A Meta só mantém dados de <strong>leitura e cliques</strong> por até{" "}
            <strong>7 dias</strong> após o envio — períodos maiores zeram esses números.
          </p>
        </div>

        {listError && <ErrorBox>Erro ao listar modelos: {listError}</ErrorBox>}
        {dataError && <ErrorBox>Erro ao carregar métricas: {dataError}</ErrorBox>}

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Left: template preview */}
          <TemplatePreviewCard template={selected} />

          {/* Right: metrics */}
          <div className="space-y-6">
            {/* Cost cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <BigStat
                label="Valor usado"
                value={t ? formatMoney(t.amountSpent, currency) : "—"}
                loading={loadingData}
              />
              <BigStat
                label="Custo por mensagem entregue"
                value={
                  analytics?.costPerDelivered != null
                    ? formatMoney(analytics.costPerDelivered, currency)
                    : "—"
                }
                loading={loadingData}
              />
              <BigStat
                label="Custo por clique no botão do site"
                value={
                  analytics?.costPerUrlClick != null
                    ? formatMoney(analytics.costPerUrlClick, currency)
                    : "—"
                }
                loading={loadingData}
              />
            </div>

            {/* Desempenho */}
            <section className="overflow-hidden rounded-2xl border border-psa-line bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-psa-line px-6 py-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-psa-ink">
                  <TrendingUp className="h-4 w-4 text-psa-orange" />
                  Desempenho
                </h2>
                <div className="flex items-center gap-1">
                  <TabButton active={tab === "trend"} onClick={() => setTab("trend")}>
                    Em alta
                  </TabButton>
                  <TabButton active={tab === "funnel"} onClick={() => setTab("funnel")}>
                    Funil
                  </TabButton>
                </div>
              </header>

              <div className="grid grid-cols-2 gap-px border-b border-psa-line bg-psa-line sm:grid-cols-4">
                <MetricCell label="Mensagens enviadas" value={t?.sent ?? null} />
                <MetricCell label="Mensagens entregues" value={t?.delivered ?? null} />
                <MetricCell
                  label="Mensagens lidas"
                  value={t?.read ?? null}
                  hint={
                    analytics?.readRate != null
                      ? `${(analytics.readRate * 100).toFixed(0)}%`
                      : undefined
                  }
                />
                <MetricCell label="Respostas únicas" value={t?.uniqueResponses ?? null} />
              </div>

              <div className="px-4 pb-6 pt-5">
                {tab === "trend" ? (
                  <TrendChart daily={analytics?.daily ?? []} loading={loadingData} />
                ) : (
                  <Funnel totals={t} />
                )}
              </div>
            </section>
          </div>
        </div>

        <footer className="mt-12 border-t border-psa-line pt-6 text-center text-xs text-psa-muted">
          PSA · Aprender é o maior Show da Terra
        </footer>
      </main>
    </div>
  );
}

function TemplatePreviewCard({ template }: { template: TemplateSummary | null }) {
  return (
    <aside className="self-start rounded-2xl border border-psa-line bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-psa-ink">Seu modelo</h3>
      <div className="overflow-hidden rounded-xl border border-psa-line bg-[#ECE5DD] p-3">
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
            <div className="mb-2 flex aspect-video w-full items-center justify-center rounded-md bg-psa-ink/90 text-xs font-semibold uppercase tracking-wider text-white">
              {template ? "Imagem do cabeçalho" : "—"}
            </div>
          )}
          <p className="whitespace-pre-line text-[13px] leading-snug text-psa-ink">
            {template?.preview.bodyText ?? "Selecione um modelo para ver o conteúdo."}
          </p>
          {template?.preview.footerText && (
            <p className="mt-1 text-[11px] text-psa-muted">{template.preview.footerText}</p>
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
      {template && (
        <dl className="mt-4 space-y-1.5 text-xs">
          <Row k="Nome" v={template.name} />
          <Row k="Categoria" v={template.category} />
          <Row k="Idioma" v={template.language} />
          <Row k="Status" v={template.status} />
        </dl>
      )}
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-psa-muted">{k}</dt>
      <dd className="truncate font-medium text-psa-ink">{v}</dd>
    </div>
  );
}

function BigStat({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-psa-line bg-white px-5 py-4 shadow-sm">
      <p className="text-xs text-psa-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-psa-ink">
        {loading ? "…" : value}
      </p>
    </div>
  );
}

function MetricCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint?: string;
}) {
  return (
    <div className="bg-white px-4 py-4">
      <p className="text-[11px] text-psa-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-psa-ink">
        {value == null ? "—" : value.toLocaleString("pt-BR")}
        {hint && <span className="ml-1.5 text-sm font-normal text-psa-muted">({hint})</span>}
      </p>
    </div>
  );
}

function TrendChart({
  daily,
  loading,
}: {
  daily: TemplateAnalytics["daily"];
  loading: boolean;
}) {
  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-psa-muted">Carregando…</div>;
  }
  if (daily.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-psa-muted">
        Sem dados para este modelo no período selecionado.
      </div>
    );
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={daily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
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
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
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

function Funnel({ totals }: { totals: TemplateAnalytics["totals"] | undefined }) {
  if (!totals) {
    return <div className="flex h-64 items-center justify-center text-sm text-psa-muted">—</div>;
  }
  const steps = [
    { label: "Enviadas", value: totals.sent, color: "#F87171" },
    { label: "Entregues", value: totals.delivered, color: "#7C3AED" },
    { label: "Lidas", value: totals.read, color: "#0D9488" },
    { label: "Respostas únicas", value: totals.uniqueResponses, color: "#16A34A" },
  ];
  const top = Math.max(totals.sent, 1);
  return (
    <div className="space-y-3 py-2">
      {steps.map((s, i) => {
        const pctOfTop = (s.value / top) * 100;
        const pctOfPrev =
          i === 0 ? null : steps[i - 1].value > 0 ? (s.value / steps[i - 1].value) * 100 : 0;
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-psa-ink">{s.label}</span>
              <span className="tabular-nums text-psa-muted">
                {s.value.toLocaleString("pt-BR")}
                {pctOfPrev != null && (
                  <span className="ml-2 text-psa-muted">→ {pctOfPrev.toFixed(0)}%</span>
                )}
              </span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded-md bg-psa-line/40">
              <div
                className="h-full rounded-md transition-all"
                style={{ width: `${Math.max(pctOfTop, 2)}%`, background: s.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md px-3 py-1.5 text-xs font-medium transition " +
        (active ? "bg-psa-blue-soft text-psa-blue" : "text-psa-muted hover:text-psa-ink")
      }
    >
      {children}
    </button>
  );
}

function DateInput({
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
      <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">
        {label}
      </label>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-md border border-psa-line bg-white px-3 py-1.5 text-sm text-psa-ink focus:border-psa-orange focus:outline-none"
      />
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  );
}
