// São Paulo is permanently UTC-3 (Brazil abolished DST in 2019).
const BR_OFFSET_MS = 3 * 60 * 60 * 1000;

export function brDay(input?: Date | number | string): string {
  const ms =
    input == null
      ? Date.now()
      : typeof input === "number"
        ? input
        : typeof input === "string"
          ? new Date(input).getTime()
          : input.getTime();
  return new Date(ms - BR_OFFSET_MS).toISOString().slice(0, 10);
}

export function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
