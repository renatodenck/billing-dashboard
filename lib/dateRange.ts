import { brDay } from "./format";

export type RangePreset =
  | "today"
  | "7d"
  | "30d"
  | "60d"
  | "thisMonth"
  | "lastMonth"
  | "all"
  | "custom";

export type DateRange = { since: string; until: string };

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  "60d": "60 dias",
  thisMonth: "Este mês",
  lastMonth: "Mês passado",
  all: "Tudo",
  custom: "Personalizado",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function presetToRange(
  preset: RangePreset,
  custom: DateRange,
  daily: Array<{ day: string }>
): DateRange {
  const todayStr = brDay();

  if (preset === "custom") return custom;

  if (preset === "today") return { since: todayStr, until: todayStr };

  if (preset === "all") {
    const days = daily.map((d) => d.day).sort();
    if (days.length === 0) return { since: todayStr, until: todayStr };
    return { since: days[0]!, until: days[days.length - 1]! };
  }

  if (preset === "thisMonth") {
    const [y, m] = todayStr.split("-");
    return { since: `${y}-${m}-01`, until: todayStr };
  }

  if (preset === "lastMonth") {
    const [yStr, mStr] = todayStr.split("-");
    let y = Number(yStr);
    let m = Number(mStr) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    const mPad = pad(m);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
      since: `${y}-${mPad}-01`,
      until: `${y}-${mPad}-${pad(lastDay)}`,
    };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 60;
  const since = brDay(Date.now() - (days - 1) * DAY_MS);
  return { since, until: todayStr };
}

export function filterDaily<T extends { day: string }>(
  daily: T[],
  range: DateRange
): T[] {
  return daily.filter((d) => d.day >= range.since && d.day <= range.until);
}

export function rangeStats(daily: Array<{ day: string; amount: number }>) {
  const total = daily.reduce((s, d) => s + d.amount, 0);
  const days = daily.length;
  const avg = days > 0 ? total / days : 0;
  const max = daily.reduce(
    (m, d) => (d.amount > m.amount ? d : m),
    { day: "", amount: 0 }
  );
  return { total, days, avg, max };
}

export function formatRangeLabel(range: DateRange): string {
  if (range.since === range.until) {
    return formatBR(range.since);
  }
  return `${formatBR(range.since)} – ${formatBR(range.until)}`;
}

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y!.slice(2)}`;
}
