const uah = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 });

export function money(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  return `${uah.format(Number(v))} грн`;
}

export function usd(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  return `$${dec.format(Number(v))}`;
}

export function num(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  return dec.format(Number(v));
}

export function pct(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  return `${dec.format(Number(v) * 100)}%`;
}

export function date(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("uk-UA");
}

export const STAGES: Record<string, string> = {
  idea: "Ідея",
  demand: "Попит",
  sourcing: "Постачальник",
  economics: "Економіка",
  test: "Тест",
  selling: "Продажі",
  paused: "Пауза",
  rejected: "Відкинуто",
};

export const ORDER_STATUSES: Record<string, string> = {
  new: "Нове",
  confirmed: "Підтверджено",
  shipped: "Відправлено",
  delivered: "Отримано",
  refused: "Відмова",
  returned: "Повернення",
  cancelled: "Скасовано",
};

export const BATCH_STATUSES: Record<string, string> = {
  ordered: "Замовлено",
  in_transit: "В дорозі",
  arrived: "На складі",
};

export const TX_KINDS: Record<string, string> = {
  investment: "Вкладення",
  purchase: "Закупівля",
  ads: "Реклама",
  delivery: "Доставка",
  revenue: "Виручка",
  withdrawal: "Виведення",
  other: "Інше",
};

export const ASSET_KINDS: Record<string, string> = {
  landing: "Лендінг",
  ad_text: "Рекламний текст",
  account: "Акаунт",
  creative: "Креатив",
};

export const ROLES: Record<string, string> = {
  lead: "Головний аналітик",
  critic: "Адвокат диявола",
  scout: "Розвідник попиту",
  sourcer: "Закупівельник",
  finance: "Фінансист",
  marketing: "Маркетолог",
  auditor: "Ревізор",
};

export const TASK_STATUSES: Record<string, string> = {
  todo: "Зробити",
  doing: "В роботі",
  done: "Готово",
  skipped: "Пропущено",
};

export const PRIORITIES: Record<string, string> = { "1": "Високий", "2": "Звичайний", "3": "Низький" };

export const SOURCE_KINDS: Record<string, string> = {
  official: "Офіційне",
  marketplace: "Маркетплейс",
  trends: "Тренди / пошук",
  media: "Медіа",
  supplier: "Постачальник",
  logistics: "Логістика",
  community: "Спільнота / відгуки",
  other: "Інше",
};

export const SOURCE_TOPICS = ["попит", "конкуренти", "постачальники", "податки", "логістика", "імпорт", "реклама", "ризики"];

export function compact(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1_000_000) return `${dec.format(n / 1_000_000)} млн`;
  if (Math.abs(n) >= 10_000) return `${uah.format(n / 1000)} тис.`;
  return uah.format(n);
}

export function range(min: number | string | null, max: number | string | null, unit = "грн") {
  if (min === null && max === null) return "—";
  if (Number(min) === Number(max)) return `${compact(min)} ${unit}`;
  return `${compact(min)}–${compact(max)} ${unit}`;
}

export function daysUntil(v: string | null | undefined) {
  if (!v) return null;
  const today = new Date(new Date().toISOString().slice(0, 10));
  return Math.round((new Date(v).getTime() - today.getTime()) / 86_400_000);
}

// Оцінка собівартості на складі для банку товарів: середня ціна в Китаї + «білий» карго
// залізницею за кг (CARGO_USD_PER_KG) + упаковка і приймання. Точну рахує калькулятор.
export const CARGO_USD_PER_KG = 4;
export function landedEstimate(
  p: { cost_min_usd?: number | string | null; cost_max_usd?: number | string | null; weight_kg?: number | string | null },
  usdRate: number,
) {
  const lo = Number(p.cost_min_usd ?? p.cost_max_usd);
  const hi = Number(p.cost_max_usd ?? p.cost_min_usd);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || (!lo && !hi) || !usdRate) return null;
  const cost = (lo + hi) / 2;
  const cargo = Number(p.weight_kg ?? 0.3) * CARGO_USD_PER_KG;
  return (cost + cargo) * usdRate + 10;
}

// Орієнтовна маржа до реклами: (ціна − собівартість − податок і комісія) / ціна.
export function roughMargin(price: number | string | null | undefined, landed: number | null, cut = 0.16) {
  const p = Number(price);
  if (!p || landed === null) return null;
  return (p * (1 - cut) - landed) / p;
}
