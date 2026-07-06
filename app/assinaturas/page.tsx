"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, RefreshCw } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { TEAMS } from "@/lib/teams";
import type { SubscriptionDTO } from "../api/subscriptions/route";

const CURRENCIES = ["USD", "BRL"] as const;

type Draft = { tool: string; team: string; costPerSeat: string; seats: string; currency: string; notes: string };

const EMPTY_DRAFT: Draft = { tool: "", team: "", costPerSeat: "", seats: "1", currency: "USD", notes: "" };

export default function SubscriptionsPage() {
  const [items, setItems] = useState<SubscriptionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((await res.json()) as SubscriptionDTO[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of items) m.set(s.currency, (m.get(s.currency) ?? 0) + s.monthly);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const totalSeats = useMemo(() => items.reduce((s, i) => s + i.seats, 0), [items]);

  const byTeam = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const s of items) {
      const t = s.team ?? "Sem time";
      if (!m.has(t)) m.set(t, new Map());
      const cm = m.get(t)!;
      cm.set(s.currency, (cm.get(s.currency) ?? 0) + s.monthly);
    }
    return [...m.entries()];
  }, [items]);

  function draftToBody(d: Draft) {
    return {
      tool: d.tool.trim(),
      team: d.team || null,
      costPerSeat: Number(d.costPerSeat.replace(",", ".")),
      seats: Number(d.seats),
      currency: d.currency,
      notes: d.notes.trim() || null,
    };
  }

  async function add() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToBody(draft)),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setDraft(EMPTY_DRAFT);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(s: SubscriptionDTO) {
    setEditingId(s.id);
    setEditDraft({
      tool: s.tool,
      team: s.team ?? "",
      costPerSeat: String(s.costPerSeat),
      seats: String(s.seats),
      currency: s.currency,
      notes: s.notes ?? "",
    });
  }

  async function saveEdit(id: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToBody(editDraft)),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number, tool: string) {
    if (!confirm(`Excluir a assinatura "${tool}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const addValid = draft.tool.trim() !== "" && Number(draft.costPerSeat.replace(",", ".")) >= 0 && Number(draft.seats) >= 1;

  return (
    <div>
      <header className="border-b border-psa-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-psa-muted transition hover:text-psa-orange">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao painel
          </Link>
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

      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-psa-orange">Painel financeiro</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-psa-ink sm:text-4xl">
          Assinaturas de usuários
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-psa-muted">
          Custos de assento (ChatGPT Team, Claude Team etc.). Esses valores{" "}
          <strong className="text-psa-ink">não vêm de API</strong> — a cobrança por assinatura é
          separada do uso de tokens, então é cadastrada aqui manualmente.
        </p>

        {/* Resumo */}
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-psa-line bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">Total mensal</p>
            <div className="mt-2 space-y-1">
              {totalsByCurrency.length === 0 ? (
                <p className="text-lg font-semibold text-psa-ink">—</p>
              ) : (
                totalsByCurrency.map(([cur, total]) => (
                  <p key={cur} className="text-xl font-semibold tabular-nums text-psa-orange">
                    {formatMoney(total, cur)}
                    <span className="ml-1 text-xs font-normal text-psa-muted">/mês</span>
                  </p>
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-psa-line bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">Assinaturas</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-psa-ink">{items.length}</p>
          </div>
          <div className="rounded-2xl border border-psa-line bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">Total de assentos</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-psa-ink">{totalSeats}</p>
          </div>
        </div>

        {byTeam.length > 0 && (
          <div className="mt-6 rounded-2xl border border-psa-line bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">
              Total por time
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {byTeam.map(([team, byCur]) => (
                <div
                  key={team}
                  className="flex items-center gap-2 rounded-full border border-psa-line bg-psa-bg/50 px-3 py-1.5"
                >
                  <span className="text-xs font-semibold text-psa-ink">{team}</span>
                  <span className="text-sm font-semibold tabular-nums text-psa-orange">
                    {[...byCur.entries()]
                      .map(([cur, total]) => formatMoney(total, cur))
                      .join(" + ")}
                    <span className="ml-1 text-[10px] font-normal text-psa-muted">/mês</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tabela */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-psa-line bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-psa-line text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-psa-muted">
                  <th className="px-4 py-3">Ferramenta</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Custo/assento</th>
                  <th className="px-4 py-3">Assentos</th>
                  <th className="px-4 py-3">Total/mês</th>
                  <th className="px-4 py-3">Moeda</th>
                  <th className="px-4 py-3">Notas</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-psa-line">
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-psa-muted">Carregando…</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-psa-muted">
                      Nenhuma assinatura cadastrada ainda. Adicione a primeira abaixo.
                    </td>
                  </tr>
                ) : (
                  items.map((s) =>
                    editingId === s.id ? (
                      <tr key={s.id} className="bg-psa-orange-soft/30">
                        <td className="px-4 py-2">
                          <input className={inputCls} value={editDraft.tool} onChange={(e) => setEditDraft({ ...editDraft, tool: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <select className={`${inputCls} w-32`} value={editDraft.team} onChange={(e) => setEditDraft({ ...editDraft, team: e.target.value })}>
                            <option value="">—</option>
                            {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input className={`${inputCls} w-28`} inputMode="decimal" value={editDraft.costPerSeat} onChange={(e) => setEditDraft({ ...editDraft, costPerSeat: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <input className={`${inputCls} w-20`} inputMode="numeric" value={editDraft.seats} onChange={(e) => setEditDraft({ ...editDraft, seats: e.target.value })} />
                        </td>
                        <td className="px-4 py-2 tabular-nums text-psa-muted">
                          {formatMoney(Number(editDraft.costPerSeat.replace(",", ".") || 0) * Number(editDraft.seats || 0), editDraft.currency)}
                        </td>
                        <td className="px-4 py-2">
                          <select className={`${inputCls} w-24`} value={editDraft.currency} onChange={(e) => setEditDraft({ ...editDraft, currency: e.target.value })}>
                            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input className={inputCls} value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => saveEdit(s.id)} disabled={saving} className={iconBtn("emerald")} title="Salvar">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className={iconBtn("muted")} title="Cancelar">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.id} className="text-psa-ink">
                        <td className="px-4 py-3 font-medium">{s.tool}</td>
                        <td className="px-4 py-3">
                          {s.team ? (
                            <span className="inline-flex items-center rounded-full bg-psa-blue-soft px-2 py-0.5 text-xs font-medium text-psa-blue">
                              {s.team}
                            </span>
                          ) : (
                            <span className="text-psa-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{formatMoney(s.costPerSeat, s.currency)}</td>
                        <td className="px-4 py-3 tabular-nums">{s.seats}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-psa-orange">{formatMoney(s.monthly, s.currency)}</td>
                        <td className="px-4 py-3 text-psa-muted">{s.currency}</td>
                        <td className="px-4 py-3 text-psa-muted">{s.notes ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => startEdit(s)} className={iconBtn("muted")} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => remove(s.id, s.tool)} disabled={saving} className={iconBtn("red")} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
              {/* Linha de adicionar */}
              <tfoot>
                <tr className="border-t border-psa-line bg-psa-bg/40">
                  <td className="px-4 py-3">
                    <input className={inputCls} placeholder="ex.: ChatGPT Team" value={draft.tool} onChange={(e) => setDraft({ ...draft, tool: e.target.value })} />
                  </td>
                  <td className="px-4 py-3">
                    <select className={`${inputCls} w-32`} value={draft.team} onChange={(e) => setDraft({ ...draft, team: e.target.value })}>
                      <option value="">—</option>
                      {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input className={`${inputCls} w-28`} inputMode="decimal" placeholder="30,00" value={draft.costPerSeat} onChange={(e) => setDraft({ ...draft, costPerSeat: e.target.value })} />
                  </td>
                  <td className="px-4 py-3">
                    <input className={`${inputCls} w-20`} inputMode="numeric" placeholder="5" value={draft.seats} onChange={(e) => setDraft({ ...draft, seats: e.target.value })} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-psa-muted">
                    {addValid ? formatMoney(Number(draft.costPerSeat.replace(",", ".")) * Number(draft.seats), draft.currency) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select className={`${inputCls} w-24`} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input className={inputCls} placeholder="opcional" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={add}
                        disabled={!addValid || saving}
                        className="inline-flex items-center gap-1.5 rounded-full bg-psa-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-psa-orange disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar
                      </button>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-psa-muted">
          Dica: cadastre o custo por assento (não o total). O painel multiplica por nº de assentos.
        </p>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-psa-line bg-white px-2.5 py-1.5 text-sm text-psa-ink focus:border-psa-orange focus:outline-none";

function iconBtn(kind: "muted" | "red" | "emerald") {
  const color =
    kind === "red"
      ? "text-red-500 hover:bg-red-50"
      : kind === "emerald"
        ? "text-emerald-600 hover:bg-emerald-50"
        : "text-psa-muted hover:bg-psa-line/40 hover:text-psa-ink";
  return `inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-40 ${color}`;
}
