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
  scout: "Розвідник попиту",
  sourcer: "Закупівельник",
  finance: "Фінансист",
  marketing: "Маркетолог",
  auditor: "Ревізор",
};
