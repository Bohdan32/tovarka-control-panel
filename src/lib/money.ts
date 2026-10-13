// Гроші ФОП 3 групи: ліміт доходу, податок кварталу, конверти прибутку.

// Ліміт доходу 3 групи — 1167 мінімальних зарплат на 1 січня року (ПКУ, ст. 291.4).
export const MIN_WAGE_2026 = 8647;
export const FOP3_LIMIT = 1167 * MIN_WAGE_2026;
// Мінімальний ЄСВ: 22% мінімальної зарплати за кожен місяць.
export const ESV_MONTH = Math.round(MIN_WAGE_2026 * 0.22 * 100) / 100;

// Розподіл прибутку: частина завжди лишається в обороті, щоб не проїсти гроші на наступну партію.
export const ENVELOPES = [
  ["turnover", "Оборот: наступна партія", 0.5],
  ["ads", "Реклама", 0.2],
  ["me", "Собі", 0.3],
] as const;

export function quarterOf(d = new Date()) {
  const q = Math.floor(d.getMonth() / 3);
  const start = new Date(Date.UTC(d.getFullYear(), q * 3, 1));
  const end = new Date(Date.UTC(d.getFullYear(), q * 3 + 3, 0));
  // Податок і ЄСВ за квартал платять протягом 50 і 20 днів після нього.
  const taxDue = new Date(end.getTime() + 50 * 86_400_000);
  const esvDue = new Date(Date.UTC(d.getFullYear(), q * 3 + 3, 20));
  return { n: q + 1, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), taxDue, esvDue };
}

export function yearStart(d = new Date()) {
  return `${d.getFullYear()}-01-01`;
}
