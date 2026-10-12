import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Badge, Card, PageHeader, Progress, Stat, Stats } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { TaskList, sortTasks, type TaskRow } from "@/components/tasks";
import { Icon } from "@/components/icons";
import { ROLES, STAGES, compact, date, daysUntil, money, pct } from "@/lib/format";

const FUNNEL = ["idea", "demand", "sourcing", "economics", "test", "selling"];

export default async function Dashboard() {
  const { supabase } = await requireMember();
  const [products, reports, economics, txs, orders, settings, tasks, stock, campaigns] = await Promise.all([
    supabase.from("products").select("id, name, stage, next_review_on"),
    supabase.from("analyst_reports").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("offer_economics").select("*").eq("is_selected", true),
    supabase.from("transactions").select("kind, amount_uah"),
    supabase.from("orders").select("status, price_uah, qty, created_at"),
    supabase.from("cost_settings").select("usd_rate, usd_rate_date").eq("id", 1).single(),
    supabase.from("tasks").select("*, products(name), playbook_steps(n, title)"),
    supabase.from("product_stock").select("*"),
    supabase.from("campaign_performance").select("spend_uah, orders_count"),
  ]);

  const byStage = new Map<string, number>();
  for (const p of products.data ?? []) byStage.set(p.stage, (byStage.get(p.stage) ?? 0) + 1);
  const funnelMax = Math.max(1, ...FUNNEL.map((s) => byStage.get(s) ?? 0));

  const sum = (kinds: string[]) =>
    (txs.data ?? []).filter((t) => kinds.includes(t.kind)).reduce((a, t) => a + Number(t.amount_uah), 0);
  const invested = sum(["investment"]);
  const cash = sum(["investment", "revenue"]) - sum(["purchase", "ads", "delivery", "withdrawal", "other"]);
  const profit = sum(["revenue"]) - sum(["purchase", "ads", "delivery", "other"]);

  const allOrders = orders.data ?? [];
  const openOrders = allOrders.filter((o) => ["new", "confirmed", "shipped"].includes(o.status)).length;
  const finished = allOrders.filter((o) => ["delivered", "refused", "returned"].includes(o.status));
  const refusal = finished.length ? finished.filter((o) => o.status !== "delivered").length / finished.length : null;
  const revenue30 = allOrders
    .filter((o) => o.status === "delivered" && (daysUntil(o.created_at.slice(0, 10)) ?? -99) >= -30)
    .reduce((a, o) => a + Number(o.price_uah) * o.qty, 0);

  const econ = economics.data ?? [];
  const failing = econ.filter((e) => !e.passes);
  const avgMargin = econ.length ? econ.reduce((a, e) => a + Number(e.margin), 0) / econ.length : null;
  const inStock = (stock.data ?? []).reduce((a, s) => a + Number(s.in_stock), 0);
  const lowStock = (stock.data ?? []).filter((s) => Number(s.in_stock) > 0 && Number(s.in_stock) <= 5);
  const adSpend = (campaigns.data ?? []).reduce((a, c) => a + Number(c.spend_uah), 0);
  const adOrders = (campaigns.data ?? []).reduce((a, c) => a + Number(c.orders_count), 0);

  const allTasks = (tasks.data ?? []) as TaskRow[];
  const doneTasks = allTasks.filter((t) => t.status === "done" || t.status === "skipped").length;
  const nextTasks = sortTasks(allTasks.filter((t) => t.status === "todo" || t.status === "doing")).slice(0, 6);
  const overdue = allTasks.filter((t) => (t.status === "todo" || t.status === "doing") && (daysUntil(t.due_on) ?? 1) < 0);
  const reviews = (products.data ?? []).filter((p) => p.next_review_on && (daysUntil(p.next_review_on) ?? 1) <= 0 && !["rejected", "paused"].includes(p.stage));

  const latestDate = reports.data?.[0]?.report_date;
  const latest = (reports.data ?? []).filter((r) => r.report_date === latestDate);
  const lead = latest.find((r) => r.role === "lead");
  const alerts = latest.filter((r) => r.severity !== "info" && r.role !== "lead");

  const signals: { tone: "red" | "amber"; text: React.ReactNode }[] = [
    ...overdue.map((t) => ({ tone: "red" as const, text: <>Прострочено: <Link href="/plan" className="underline">{t.title}</Link></> })),
    ...failing.map((e) => ({ tone: "red" as const, text: <>Маржа {pct(e.margin)} нижче порогу: <Link href={`/products/${e.product_id}`} className="underline">{e.product_name}</Link></> })),
    ...lowStock.map((s) => ({ tone: "amber" as const, text: <>Закінчується: {s.name} — {s.in_stock} шт</> })),
    ...reviews.map((p) => ({ tone: "amber" as const, text: <>Час переглянути товар: <Link href={`/products/${p.id}`} className="underline">{p.name}</Link></> })),
    ...alerts.map((a) => ({ tone: a.severity === "critical" ? ("red" as const) : ("amber" as const), text: <>{ROLES[a.role] ?? a.role}: {a.title}</> })),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Огляд"
        subtitle={`Курс НБУ ${settings.data?.usd_rate ?? "—"} грн/$ · ${date(settings.data?.usd_rate_date)}`}
      />

      <Stats>
        <Stat label="План запуску" value={`${Math.round((doneTasks / Math.max(allTasks.length, 1)) * 100)}%`} hint={`${doneTasks} з ${allTasks.length} задач`} href="/plan" />
        <Stat label="Товарів у роботі" value={FUNNEL.reduce((a, s) => a + (byStage.get(s) ?? 0), 0)} hint={`${byStage.get("test") ?? 0} на тесті · ${byStage.get("selling") ?? 0} продаються`} href="/products" />
        <Stat label="Середня маржа" value={pct(avgMargin)} hint={`${failing.length} не проходять`} tone={failing.length ? "bad" : avgMargin !== null ? "good" : undefined} href="/calculator" />
        <Stat label="Вкладено" value={money(invested)} href="/finance" />
        <Stat label="Гроші в обороті" value={money(cash)} tone={cash < 0 ? "bad" : undefined} href="/finance" />
        <Stat label="Прибуток" value={money(profit)} tone={profit < 0 ? "bad" : profit > 0 ? "good" : undefined} href="/finance" />
        <Stat label="Відкриті замовлення" value={openOrders} href="/orders" />
        <Stat label="Виручка 30 днів" value={money(revenue30)} href="/orders" />
        <Stat label="Частка відмов" value={pct(refusal)} tone={refusal !== null && refusal > 0.2 ? "bad" : undefined} href="/orders" />
        <Stat label="На складі" value={`${compact(inStock)} шт`} hint={lowStock.length ? `${lowStock.length} закінчуються` : undefined} tone={lowStock.length ? "warn" : undefined} href="/inventory" />
        <Stat label="Реклама" value={money(adSpend)} hint={adOrders ? `CPA ${money(adSpend / adOrders)}` : "замовлень ще немає"} href="/marketing" />
        <Stat label="Курс $" value={`${Number(settings.data?.usd_rate ?? 0).toFixed(2)}`} hint="оновлюється щодня" href="/settings" />
      </Stats>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title="Наступні дії" action={<Link href="/plan" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">Увесь план →</Link>}>
            <TaskList tasks={nextTasks} showContext empty="Усі задачі виконані" />
          </Card>

          <Card title={latestDate ? `Аналітик · ${date(latestDate)}` : "Аналітик"} action={<Link href="/analyst" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">Усі звіти →</Link>}>
            {lead ? (
              <Markdown text={lead.body} />
            ) : (
              <p className="text-sm text-zinc-500">Аналітик запускається щоранку і пише сюди, що змінилось і що робити.</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={`Сигнали · ${signals.length}`}>
            {signals.length ? (
              <ul className="space-y-2">
                {signals.slice(0, 10).map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <Icon name="alert" className={`mt-0.5 size-4 shrink-0 ${s.tone === "red" ? "text-red-500" : "text-amber-500"}`} />
                    <span className="min-w-0">{s.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">Тихо: нічого не горить.</p>
            )}
          </Card>

          <Card title="Воронка товарів">
            <div className="space-y-1.5">
              {FUNNEL.map((s) => {
                const n = byStage.get(s) ?? 0;
                return (
                  <Link key={s} href={`/products?stage=${s}`} className="flex items-center gap-3 rounded-lg px-1 py-0.5 text-sm hover:bg-zinc-50 dark:hover:bg-white/5">
                    <span className="w-24 shrink-0 text-zinc-600 dark:text-zinc-400">{STAGES[s]}</span>
                    <span className="flex-1"><Progress value={n / funnelMax} /></span>
                    <span className="w-6 text-right font-semibold tabular-nums">{n}</span>
                  </Link>
                );
              })}
              <div className="flex gap-2 pt-1 text-xs text-zinc-500">
                <Badge>Пауза {byStage.get("paused") ?? 0}</Badge>
                <Badge>Відкинуто {byStage.get("rejected") ?? 0}</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
