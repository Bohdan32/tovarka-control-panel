import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Badge, Card, Progress } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { TaskList, sortTasks, type TaskRow } from "@/components/tasks";
import { Icon } from "@/components/icons";
import { compact, date, daysUntil, landedEstimate, money, pct, roughMargin } from "@/lib/format";

const RAIL_DAYS = 55;
const open = (t: TaskRow) => t.status === "todo" || t.status === "doing";
const hours = (min: number) => (min < 60 ? `${min} хв` : `${Math.round(min / 6) / 10} год`);

export default async function Navigator() {
  const { supabase, member } = await requireMember();
  const [{ data: steps }, { data: taskRows }, { data: products }, { data: reports }, { data: settings }] = await Promise.all([
    supabase.from("playbook_steps").select("*").order("n"),
    supabase.from("tasks").select("*, products(name), playbook_steps(n, title)"),
    supabase.from("products").select("*").neq("stage", "rejected").order("score", { ascending: false, nullsFirst: false }),
    supabase.from("analyst_reports").select("*").eq("role", "lead").order("created_at", { ascending: false }).limit(1),
    supabase.from("cost_settings").select("usd_rate, usd_rate_date").eq("id", 1).single(),
  ]);
  const tasks = (taskRows ?? []) as TaskRow[];
  const all = steps ?? [];
  const progress = (id: string) => {
    const rows = tasks.filter((t) => t.step_id === id);
    return { done: rows.filter((t) => !open(t)).length, total: rows.length };
  };
  const current = all.find((s) => tasks.some((t) => t.step_id === s.id && open(t))) ?? all[all.length - 1];
  const currentTasks = current ? sortTasks(tasks.filter((t) => t.step_id === current.id && open(t))) : [];
  const nextSteps = currentTasks.slice(0, 3);
  const doneAll = tasks.filter((t) => !open(t)).length;
  const leftSteps = all.filter((s) => progress(s.id).done < progress(s.id).total);
  const leftMin = tasks.filter((t) => t.step_id && open(t)).reduce((a, t) => a + Number(t.minutes ?? 30), 0);
  const leftCost = [leftSteps.reduce((a, s) => a + Number(s.cost_min_uah ?? 0), 0), leftSteps.reduce((a, s) => a + Number(s.cost_max_uah ?? 0), 0)];

  const rate = Number(settings?.usd_rate ?? 0);
  const inTest = (products ?? []).filter((p) => !["idea", "demand", "paused"].includes(p.stage));
  const testTasks = sortTasks(tasks.filter((t) => t.product_id && open(t) && inTest.some((p) => p.id === t.product_id))).slice(0, 4);
  const hot = (products ?? [])
    .filter((p) => p.stage === "idea" && p.price_median_uah)
    .map((p) => {
      const by = p.stock_by ? new Date(new Date(p.stock_by).getTime() - RAIL_DAYS * 864e5).toISOString().slice(0, 10) : null;
      return { ...p, orderBy: by, left: daysUntil(by), margin: roughMargin(p.price_median_uah, landedEstimate(p, rate)) };
    })
    .filter((p) => (p.margin ?? 0) >= 0.3 && (p.left === null || p.left >= 0))
    .sort((a, b) => (a.left ?? 999) - (b.left ?? 999) || (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 4);
  const lead = reports?.[0];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Привіт, {member.displayName}</h1>
        <p className="text-[13px] text-zinc-500 sm:text-sm">
          Виконано {doneAll} з {tasks.length} задач · до перших продажів ≈ {hours(leftMin)} роботи і {compact(leftCost[0])}–{compact(leftCost[1])} грн · $ {rate.toFixed(2)}
        </p>
      </header>

      {/* Шлях: 8 кроків від ФОП до продажів */}
      <nav className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {all.map((s) => {
          const p = progress(s.id);
          const done = p.total > 0 && p.done === p.total;
          const isCur = s.id === current?.id;
          return (
            <Link key={s.id} href={`/plan#step-${s.n}`}
              className={`min-w-[7.5rem] flex-1 rounded-lg border px-2.5 py-2 text-xs transition ${
                isCur ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15" : done ? "border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-500/10" : "border-black/[.07] bg-white dark:border-white/10 dark:bg-zinc-900"
              }`}>
              <span className={`flex items-center gap-1 font-medium ${isCur ? "text-indigo-700 dark:text-indigo-300" : done ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500"}`}>
                {done ? <Icon name="check" className="size-3.5" /> : <span>{s.n}.</span>} {done ? "готово" : isCur ? "зараз" : `${p.done}/${p.total}`}
              </span>
              <span className="mt-0.5 block truncate text-zinc-700 dark:text-zinc-300">{s.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {current && (
            <section className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm dark:border-indigo-500/30 dark:bg-zinc-900">
              <div className="text-[11px] font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Крок {current.n} з {all.length} · зараз</div>
              <h2 className="mt-0.5 text-lg font-semibold">{current.title}</h2>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-zinc-500">Навіщо: </span>{current.why ?? current.goal}</p>
                <p><span className="text-zinc-500">Що отримаєш: </span>{current.result ?? "—"}</p>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex-1"><Progress value={progress(current.id).done / Math.max(progress(current.id).total, 1)} /></span>
                <span>{progress(current.id).done}/{progress(current.id).total}</span>
                <span>{money(current.cost_min_uah)}{Number(current.cost_max_uah) > Number(current.cost_min_uah) ? `–${money(current.cost_max_uah)}` : ""}</span>
              </div>
              <h3 className="mb-1 mt-4 text-sm font-semibold">Зроби зараз</h3>
              <TaskList tasks={nextSteps} empty="Крок завершено" />
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <Link href={`/plan#step-${current.n}`} className="text-indigo-600 hover:underline dark:text-indigo-400">Як саме і які є варіанти →</Link>
                {currentTasks.length > 3 && <span className="text-zinc-500">ще {currentTasks.length - 3} у цьому кроці</span>}
              </div>
            </section>
          )}

          {inTest.length > 0 && (
            <Card title={`Товар у тесті · ${inTest.map((p) => p.name).join(", ")}`} action={<Link href={`/products/${inTest[0].id}`} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">Картка →</Link>}>
              <TaskList tasks={testTasks} empty="Усі кроки тесту виконані" />
            </Card>
          )}

          <Card title="Що каже аналітик" action={<Link href="/analyst" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">Усі звіти →</Link>}>
            {lead ? (
              <>
                <p className="mb-2 text-xs text-zinc-500">{date(lead.report_date)}</p>
                <Markdown text={lead.body} />
              </>
            ) : (
              <p className="text-sm text-zinc-500">Аналітик пише сюди щоранку: що змінилось і що робити.</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Товари, які варто глянути" action={<Link href="/products" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">Банк товарів →</Link>}>
            {hot.length ? (
              <ul className="divide-y divide-black/[.06] dark:divide-white/5">
                {hot.map((p) => (
                  <li key={p.id} className="py-2">
                    <Link href={`/products/${p.id}`} className="text-sm font-medium hover:text-indigo-600 dark:hover:text-indigo-400">{p.name}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <span>{money(p.price_median_uah)}</span>
                      <span>· маржа ≈ {pct(p.margin)}</span>
                      <span>· оцінка {p.score}</span>
                      {p.left !== null ? <Badge tone={p.left <= 14 ? "amber" : "blue"}>замовити за {p.left} дн.</Badge> : <Badge tone="green">цілий рік</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">Аналітик ще наповнює банк товарів.</p>
            )}
          </Card>

          <Card title="Корисне">
            <div className="grid gap-2 text-sm">
              <Link href="/sell" className="flex items-center gap-2 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-white/5"><Icon name="megaphone" className="size-4 text-indigo-500" /> Як продавати: канали, відгуки, реклама</Link>
              <Link href="/sell?s=simulator" className="flex items-center gap-2 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-white/5"><Icon name="calc" className="size-4 text-indigo-500" /> Симулятор: скільки заробиш або втратиш</Link>
              <Link href="/sell?s=texts" className="flex items-center gap-2 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-white/5"><Icon name="book" className="size-4 text-indigo-500" /> Готові відповіді покупцям</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
