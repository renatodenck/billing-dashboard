"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { ExternalLink } from "lucide-react";
import { formatDateBR, formatMoney } from "@/lib/format";
import type { TemplateAnalytics, TemplateSummary } from "@/lib/metaTemplates";

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

const PRESETS = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "60d", label: "60 dias" },
] as const;

type Payload = {
  title: string;
  subtitle: string;
  template: TemplateSummary;
  analytics: TemplateAnalytics;
};

export default function SharePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>("7d");

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/${slug}?preset=${preset}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json as Payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slug, preset]);

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
          <div className="flex items-center gap-1.5">
            {PRESETS.map((p) => {
              const active = preset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPreset(p.key)}
                  className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition"
                  style={
                    active
                      ? { background: C.yellow, color: "#1a1500" }
                      : { color: C.muted, border: `1px solid ${C.line}` }
                  }
                >
                  {p.label}
                </button>
              );
            })}
          </div>
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

      <main className="mx-auto max-w-5xl px-6 py-8">
        {error && (
          <div
            className="mb-6 rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(232,49,42,.12)", border: `1px solid ${C.red}`, color: "#ffb3b0" }}
          >
            {error}
          </div>
        )}

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
          </div>
        </div>

        <footer className="mt-12 pt-6 text-center text-xs" style={{ borderTop: `1px solid ${C.line}`, color: C.muted }}>
          The Best Speaker Brasil · Profissionais SA
        </footer>
      </main>
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
