import { date, daysUntil, fitIssues } from "./format";

export const RAIL_DAYS = 55; // зразки + виробництво + залізниця до складу
export const AIR_DAYS = 25;

export type CalKind = "season" | "tax" | "china" | "market" | "task" | "product";
export type CalItem = { date: string; kind: CalKind; title: string; note?: string | null; href?: string };
export type CalEvent = { kind: string; title: string; note: string | null; starts_on: string; ends_on: string | null };

const shift = (d: string, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x.toISOString().slice(0, 10);
};

export const KIND_LABEL: Record<CalKind, string> = {
  season: "сезон", tax: "податки", china: "Китай", market: "майданчики", task: "задача", product: "товар",
};

// Збирає календар: сезони (дата «замовити до»), податки, свята Китаю, дедлайни задач і товарів у роботі.
export function buildCalendar(
  events: CalEvent[],
  tasks: { id: string; title: string; due_on: string | null; status: string; source: string }[],
  products: { id: string; name: string; stage: string; stock_by: string | null; weight_kg?: number | string | null; price_median_uah?: number | string | null; fit_block?: string[] | null }[],
) {
  const items: CalItem[] = [];
  const now: { title: string; note: string; tone: "amber" | "red" }[] = [];
  for (const e of events) {
    if (e.kind === "season") {
      const orderBy = shift(e.starts_on, -RAIL_DAYS);
      const left = daysUntil(orderBy) ?? 0;
      const end = e.ends_on ?? e.starts_on;
      if (left >= 0) {
        items.push({ date: orderBy, kind: "season", title: `Замовити партію: ${e.title}`, note: `Сезон ${date(e.starts_on)}–${date(end)}. ${e.note ?? ""}` });
      } else if ((daysUntil(end) ?? -1) >= 0) {
        const airOk = (daysUntil(shift(end, -AIR_DAYS - 14)) ?? -1) >= 0;
        now.push({
          title: e.title,
          note: airOk ? `Залізницею вже пізно, авіа ще встигає (сезон до ${date(end)}).` : `Для нових партій уже пізно: сезон до ${date(end)}. Плануй на наступний рік.`,
          tone: airOk ? "amber" : "red",
        });
      }
    } else {
      items.push({ date: e.starts_on, kind: e.kind as CalKind, title: e.title, note: e.note });
    }
  }
  for (const t of tasks) {
    if (!t.due_on || t.source === "claude" || t.status === "done" || t.status === "skipped") continue;
    if ((daysUntil(t.due_on) ?? 0) < -7) continue;
    items.push({ date: t.due_on, kind: "task", title: t.title, href: "/plan" });
  }
  const bank: Record<string, number> = {};
  for (const p of products) {
    if (!p.stock_by || p.stage === "rejected" || p.stage === "paused") continue;
    const orderBy = shift(p.stock_by, -RAIL_DAYS);
    if ((daysUntil(orderBy) ?? -1) < 0) continue;
    if (["idea", "demand"].includes(p.stage)) {
      if (fitIssues(p).block.length) continue;
      const month = orderBy.slice(0, 7);
      bank[month] = (bank[month] ?? 0) + 1;
    } else {
      items.push({ date: orderBy, kind: "product", title: `Замовити «${p.name}»`, note: `Має бути на складі до ${date(p.stock_by)}.`, href: `/products/${p.id}` });
    }
  }
  for (const [month, n] of Object.entries(bank)) {
    const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0);
    const d = `${month}-${String(last.getDate()).padStart(2, "0")}`;
    items.push({ date: d, kind: "product", title: `${n} сезонних товарів з банку треба замовити до кінця місяця`, href: "/products?f=season" });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  return { items: items.filter((i) => (daysUntil(i.date) ?? 0) >= -7), now };
}
