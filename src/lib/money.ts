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

type OrderRow = { product_id: string; status: string; qty: number; price_uah: number | string; created_at: string; products?: { name?: string } | { name?: string }[] | null };
type BatchRow = { product_id: string; qty: number; total_cost_uah: number | string; status: string };

// Прибуток по товарах з отриманих замовлень і скільки грошей заморожено в товарі.
export function productProfit({ orders, batches, ads, stock, cut, returnShipping, now = Date.now() }: {
  orders: OrderRow[];
  batches: BatchRow[];
  ads: { product_id: string; spend_uah: number | string }[];
  stock: { product_id: string | null; in_stock: number | null }[];
  cut: number;
  returnShipping: number;
  now?: number;
}) {
  const unitCost = new Map<string, number>();
  const agg = new Map<string, { qty: number; cost: number }>();
  for (const b of batches) {
    const a = agg.get(b.product_id) ?? { qty: 0, cost: 0 };
    agg.set(b.product_id, { qty: a.qty + b.qty, cost: a.cost + Number(b.total_cost_uah) });
  }
  for (const [id, a] of agg) if (a.qty) unitCost.set(id, a.cost / a.qty);

  const name = (o: OrderRow) => (Array.isArray(o.products) ? o.products[0]?.name : o.products?.name) ?? "—";
  const rows = new Map<string, { id: string; name: string; units: number; revenue: number; refusedCount: number }>();
  for (const o of orders) {
    const r = rows.get(o.product_id) ?? { id: o.product_id, name: name(o), units: 0, revenue: 0, refusedCount: 0 };
    if (o.status === "delivered") { r.units += o.qty; r.revenue += Number(o.price_uah) * o.qty; }
    if (o.status === "refused" || o.status === "returned") r.refusedCount++;
    rows.set(o.product_id, r);
  }
  const adSpend = new Map<string, number>();
  for (const a of ads) adSpend.set(a.product_id, (adSpend.get(a.product_id) ?? 0) + Number(a.spend_uah));

  const out = [...rows.values()]
    .filter((r) => r.units || r.refusedCount || adSpend.get(r.id))
    .map((r) => {
      const goods = r.units * (unitCost.get(r.id) ?? 0);
      const adsUah = adSpend.get(r.id) ?? 0;
      const refusals = r.refusedCount * returnShipping;
      const cuts = r.revenue * cut;
      return { id: r.id, name: r.name, units: r.units, revenue: r.revenue, goods, ads: adsUah, refusals, cuts, profit: r.revenue - goods - adsUah - refusals - cuts };
    })
    .sort((a, b) => b.profit - a.profit);

  // Заморожено: партії в дорозі + залишок на складі за середньою собівартістю.
  const inTransit = batches.filter((b) => b.status !== "arrived").reduce((a, b) => a + Number(b.total_cost_uah), 0);
  const onShelf = stock.reduce((a, s) => a + Math.max(Number(s.in_stock), 0) * (unitCost.get(s.product_id ?? "") ?? 0), 0);
  const frozen = inTransit + onShelf;
  const since = now - 30 * 86_400_000;
  const cashIn30 = orders
    .filter((o) => o.status === "delivered" && new Date(o.created_at).getTime() >= since)
    .reduce((a, o) => a + Number(o.price_uah) * o.qty * (1 - cut), 0);
  const daysBack = cashIn30 > 0 && frozen > 0 ? Math.ceil(frozen / (cashIn30 / 30)) : null;
  const backBy = daysBack === null ? null : new Date(now + daysBack * 86_400_000).toISOString();
  return { rows: out, frozen, daysBack, backBy };
}
