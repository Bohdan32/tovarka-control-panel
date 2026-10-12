import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Badge, Card, PageHeader, Pills, type Tone } from "@/components/ui";
import { KIND_LABEL, RAIL_DAYS, buildCalendar, type CalItem, type CalKind } from "@/lib/calendar";
import { daysUntil } from "@/lib/format";

export const metadata: Metadata = { title: "Календар" };

const TONE: Record<CalKind, Tone> = { season: "blue", tax: "red", china: "amber", market: "green", task: "gray", product: "green" };
const VIEWS: Record<string, [string, (i: CalItem) => boolean]> = {
  all: ["Усе", () => true],
  tax: ["Податки", (i) => i.kind === "tax"],
  season: ["Сезони і товари", (i) => i.kind === "season" || i.kind === "product"],
  china: ["Китай", (i) => i.kind === "china"],
  task: ["Мої задачі", (i) => i.kind === "task"],
};

function when(d: string) {
  const left = daysUntil(d) ?? 0;
  if (left === 0) return "сьогодні";
  if (left === 1) return "завтра";
  if (left < 0) return `${-left} дн. тому`;
  return `за ${left} дн.`;
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { k } = await searchParams;
  const view = typeof k === "string" && k in VIEWS ? k : "all";
  const { supabase } = await requireMember();
  const [{ data: events }, { data: tasks }, { data: products }] = await Promise.all([
    supabase.from("calendar_events").select("kind, title, note, starts_on, ends_on").order("starts_on"),
    supabase.from("tasks").select("id, title, due_on, status, source").not("due_on", "is", null),
    supabase.from("products").select("id, name, stage, stock_by, weight_kg, price_median_uah, fit_block").not("stock_by", "is", null),
  ]);
  const { items, now } = buildCalendar(events ?? [], tasks ?? [], products ?? []);
  const shown = items.filter(VIEWS[view][1]);
  const months = new Map<string, CalItem[]>();
  for (const i of shown) {
    const m = i.date.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), i]);
  }
  const monthName = (m: string) => new Date(`${m}-01`).toLocaleDateString("uk-UA", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <PageHeader title="Календар" subtitle={`Податки, сезони і дедлайни на одній стрічці. Для сезону показано дату «замовити до»: старт сезону мінус ${RAIL_DAYS} днів на зразки, виробництво і залізницю.`} />
      <Pills active={`/calendar${view === "all" ? "" : `?k=${view}`}`}
        items={Object.entries(VIEWS).map(([key, [label, f]]) => [`/calendar${key === "all" ? "" : `?k=${key}`}`, label, items.filter(f).length] as [string, string, number])} />

      {now.length > 0 && (view === "all" || view === "season") && (
        <Card title="Сезони, що вже йдуть">
          <ul className="space-y-1.5 text-sm">
            {now.map((n) => (
              <li key={n.title} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{n.title}</span>
                <span className={n.tone === "red" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}>{n.note}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {[...months.entries()].map(([m, rows]) => (
        <section key={m}>
          <h2 className="mb-1.5 text-sm font-semibold capitalize text-zinc-500">{monthName(m)}</h2>
          <ul className="divide-y divide-black/[.05] rounded-xl border border-black/[.07] bg-white dark:divide-white/5 dark:border-white/10 dark:bg-zinc-900">
            {rows.map((i, n) => {
              const left = daysUntil(i.date) ?? 0;
              const body = (
                <>
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-lg font-semibold leading-none tabular-nums">{new Date(i.date).getDate()}</div>
                    <div className={`mt-0.5 text-[10px] ${left < 0 ? "text-zinc-400" : left <= 7 ? "font-medium text-amber-600 dark:text-amber-400" : "text-zinc-500"}`}>{when(i.date)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-sm font-medium ${left < 0 ? "text-zinc-400" : ""}`}>{i.title}</span>
                      <Badge tone={TONE[i.kind]}>{KIND_LABEL[i.kind]}</Badge>
                    </div>
                    {i.note && <p className="mt-0.5 text-xs leading-snug text-zinc-500">{i.note}</p>}
                  </div>
                </>
              );
              return (
                <li key={`${i.date}-${n}`}>
                  {i.href ? <Link href={i.href} className="flex gap-3 p-2.5 hover:bg-zinc-50 dark:hover:bg-white/5">{body}</Link> : <div className="flex gap-3 p-2.5">{body}</div>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!shown.length && <p className="py-6 text-center text-sm text-zinc-500">Тут поки порожньо.</p>}

      <p className="text-xs text-zinc-500">
        Податкові дати — для ФОП 3 групи без ПДВ; суми і ставки перевіряй в Електронному кабінеті перед сплатою. Якщо ФОП ще не зареєстровано, податки починаються з місяця реєстрації.
      </p>
    </div>
  );
}
