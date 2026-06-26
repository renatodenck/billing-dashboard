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

const SERIES = [
  { key: "sent", label: "Enviadas", color: "#F87171" },
  { key: "delivered", label: "Entregues", color: "#7C3AED" },
  { key: "read", label: "Lidas", color: "#0D9488" },
  { key: "responses", label: "Respostas únicas", color: "#16A34A" },
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
    <div className="min-h-screen bg-psa-bg">
      <header className="border-b border-psa-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-psa-ink">
              {data?.title ?? "Desempenho do modelo"}
            </h1>
            <p className="text-xs text-psa-muted">{data?.subtitle ?? "WhatsApp"}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                className={
                  "rounded-full px-3 py-1.5 text-xs font-medium transition " +
                  (preset === p.key
                    ? "bg-psa-ink text-white"
                    : "bg-white text-psa-muted hover:bg-psa-line/40 hover:text-psa-ink")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <TemplatePreviewCard template={data?.template ?? null} />

          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <BigStat
                label="Valor usado"
                value={t ? formatMoney(t.amountSpent, currency) : "—"}
                loading={loading}
              />
              <BigStat
                label="Custo por mensagem entregue"
                value={a?.costPerDelivered != null ? formatMoney(a.costPerDelivered, currency) : "—"}
                loading={loading}
              />
              <BigStat
                label="Custo por clique no botão do site"
                value={a?.costPerUrlClick != null ? formatMoney(a.costPerUrlClick, currency) : "—"}
                loading={loading}
              />
            </div>

            <section className="overflow-hidden rounded-2xl border border-psa-line bg-white shadow-sm">
              <header className="border-b border-psa-line px-6 py-4">
                <h2 className="text-base font-semibold text-psa-ink">Desempenho</h2>
              </header>

              <div className="grid grid-cols-2 gap-px border-b border-psa-line bg-psa-line sm:grid-cols-4">
                <MetricCell label="Mensagens enviadas" value={t?.sent ?? null} />
                <MetricCell label="Mensagens entregues" value={t?.delivered ?? null} />
                <MetricCell
                  label="Mensagens lidas"
                  value={t?.read ?? null}
                  hint={a?.readRate != null ? `${(a.readRate * 100).toFixed(0)}%` : undefined}
                />
                <MetricCell label="Respostas únicas" value={t?.uniqueResponses ?? null} />
              </div>

              <div className="px-4 pb-6 pt-5">
                <TrendChart daily={a?.daily ?? []} loading={loading} />
              </div>
            </section>
          </div>
        </div>

        <footer className="mt-12 border-t border-psa-line pt-6 text-center text-xs text-psa-muted">
          Profissionais SA · dados do WhatsApp Business
        </footer>
      </main>
    </div>
  );
}

function TemplatePreviewCard({ template }: { template: TemplateSummary | null }) {
  return (
    <aside className="self-start rounded-2xl border border-psa-line bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-psa-ink">Modelo</h3>
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
            {template?.preview.bodyText ?? "Carregando…"}
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
    </aside>
  );
}

function BigStat({ label, value, loading }: { label: string; value: string; loading: boolean }) {
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
    return (
      <div className="flex h-64 items-center justify-center text-sm text-psa-muted">Carregando…</div>
    );
  }
  if (daily.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-psa-muted">
        Sem dados no período.
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
