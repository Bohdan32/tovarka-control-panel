import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Badge, Card, Progress } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { TaskList, sortTasks, type TaskRow } from "@/components/tasks";
import { Icon } from "@/components/icons";
import { buildCalendar } from "@/lib/calendar";
import { LYING_DAYS, daysSince } from "@/lib/orders";
import { addInbox, inboxDone } from "./actions";
import { compact, date, daysUntil, fitIssues, landedEstimate, money, pct, roughMargin } from "@/lib/format";

const RAIL_DAYS = 55;
const INBOX_KIND: Record<string, string> = { note: "нотатка", expense: "витрата", task: "задача", idea: "ідея", voice: "голосове" };
const open = (t: TaskRow) => t.status === "todo" || t.status === "doing";
const hours = (min: number) => (min < 60 ? `${min} хв` : `${Math.round(min / 6) / 10} год`);

export default async function Navigator() {
  const { supabase, member } = await requireMember();
  const [{ data: steps }, { data: taskRows }, { data: products }, { data: reports }, { data: settings }, { data: events }, { data: shipped }, { data: campaigns }, { data: inbox }, { data: bot }, { data: txs }, { data: batches }, { data: stock }, { data: fx }] = await Promise.all([
    supabase.from("playbook_steps").select("*").order("n"),
    supabase.from("tasks").select("*, products(name), playbook_steps(n, title)").neq("source", "claude"),
    supabase.from("products").select("*").neq("stage", "rejected").order("score", { ascending: false, nullsFirst: false }),
    supabase.from("analyst_reports").select("*").eq("role", "lead").order("created_at", { ascending: false }).limit(1),
    supabase.from("cost_settings").select("usd_rate, usd_rate_date").eq("id", 1).single(),
    supabase.from("calendar_events").select("kind, title, note, starts_on, ends_on"),
    supabase.from("orders").select("arrived_at").eq("status", "shipped").not("arrived_at", "is", null),
    supabase.from("campaign_performance").select("product_name, spend_uah, orders_count, cpa_max_uah").eq("status", "active").eq("orders_count", 0),
    supabase.from("inbox").select("*").eq("done", false).order("created_at", { ascending: false }).limit(20),
    supabase.from("bot_settings").select("owner_chat_id").eq("id", 1).single(),
    supabase.from("transactions").select("kind, amount_uah"),
    supabase.from("inventory_batches").select("product_id, qty, total_cost_uah"),
    supabase.from("product_stock").select("product_id, in_stock, incoming"),
    supabase.from("fx_rates").select("rate, rate_date").eq("currency", "USD").order("rate_date", { ascending: false }).limit(40),
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
    .filter((p) => p.stage === "idea" && p.price_median_uah && !fitIssues(p).block.length)
    .map((p) => {
      const by = p.stock_by ? new Date(new Date(p.stock_by).getTime() - RAIL_DAYS * 864e5).toISOString().slice(0, 10) : null;
      return { ...p, orderBy: by, left: daysUntil(by), margin: roughMargin(p.price_median_uah, landedEstimate(p, rate)) };
    })
    .filter((p) => (p.margin ?? 0) >= 0.3 && (p.left === null || p.left >= 0))
    .sort((a, b) => (a.left ?? 999) - (b.left ?? 999) || (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 4);
  const lead = reports?.[0];
  const soon = buildCalendar(events ?? [], [], products ?? []).items.filter((i) => (daysUntil(i.date) ?? 99) >= 0 && (daysUntil(i.date) ?? 99) <= 45).slice(0, 4);
  // Задачі з інших кроків, у яких скоро дедлайн (наприклад, акція з кінцем терміну).
  const urgent = sortTasks(tasks.filter((t) => open(t) && t.step_id !== current?.id && !t.product_id && (daysUntil(t.due_on) ?? 99) <= 21)).slice(0, 3);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Привіт, {member.displayName}</h1>
        <p className="text-[13px] text-zinc-500 sm:text-sm">
          Виконано {doneAll} з {tasks.length} задач · до перших продажів ≈ {hours(leftMin)} роботи і {compact(leftCost[0])}–{compact(leftCost[1])} грн · $ {rate.toFixed(2)}
        </p>
      </header>

      {(() => {
        // «Гроші одним рядком»: скільки вклали, скільки повернулось і скільки зараз лежить у товарі.
        const sum = (k: string) => (txs ?? []).filter((t) => t.kind === k).reduce((a, t) => a + Number(t.amount_uah), 0);
        const invested = sum("investment");
        const returned = sum("revenue");
        const unit = new Map<string, { qty: number; cost: number }>();
        for (const b of batches ?? []) {
          const u = unit.get(b.product_id) ?? { qty: 0, cost: 0 };
          unit.set(b.product_id, { qty: u.qty + b.qty, cost: u.cost + Number(b.total_cost_uah) });
        }
        const inGoods = (stock ?? []).reduce((a, s) => {
          const u = unit.get(s.product_id ?? "");
          return u && u.qty ? a + (u.cost / u.qty) * Math.max(Number(s.in_stock) + Number(s.incoming), 0) : a;
        }, 0);
        if (!invested && !returned && !inGoods) return null;
        return (
          <Link href="/finance" className="grid grid-cols-3 divide-x divide-black/[.07] rounded-xl border border-black/[.07] bg-white text-center dark:divide-white/10 dark:border-white/10 dark:bg-zinc-900">
            {[["Вкладено", invested], ["Повернулось", returned], ["Зараз у товарі", inGoods]].map(([l, v]) => (
              <span key={l as string} className="px-2 py-2">
                <span className="block text-[11px] text-zinc-500">{l}</span>
                <span className="block text-sm font-semibold tabular-nums">{money(v as number)}</span>
              </span>
            ))}
          </Link>
        );
      })()}

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

          {(() => {
            // Курс долара за місяць виріс більш ніж на 3% → ціни в Китаї подорожчали в гривні.
            const fxNow = Number(fx?.[0]?.rate ?? 0);
            const fxThen = Number(fx?.[Math.min(29, (fx?.length ?? 1) - 1)]?.rate ?? 0);
            const fxJump = fxNow && fxThen ? fxNow / fxThen - 1 : 0;
            const lying = (shipped ?? []).filter((o) => (daysSince(o.arrived_at) ?? 0) >= LYING_DAYS).length;
            const stop = (campaigns ?? []).filter((c) => c.cpa_max_uah && Number(c.spend_uah) >= 2 * Number(c.cpa_max_uah));
            if (!lying && !stop.length && fxJump < 0.03) return null;
            return (
              <div className="space-y-1 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                {lying > 0 && <p><Link href="/orders" className="font-semibold hover:underline">{lying} посил. лежать у відділенні 3+ дні →</Link> напиши покупцям, поки не поїхали назад.</p>}
                {fxJump >= 0.03 && <p><Link href="/calculator" className="font-semibold hover:underline">Долар подорожчав на {pct(fxJump)} за місяць →</Link> собівартість і рекомендовані ціни вже перераховані, перевір свої ціни на майданчиках.</p>}
                {stop.length > 0 && <p><Link href="/marketing" className="font-semibold hover:underline">Зупини рекламу: {stop.map((c) => c.product_name).join(", ")} →</Link> дві допустимі ціни замовлення без продажу.</p>}
              </div>
            );
          })()}

          {urgent.length > 0 && (
            <Card title="Не пропусти: є дедлайн">
              <TaskList tasks={urgent} showContext />
            </Card>
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

          {soon.length > 0 && (
            <Card title="Найближче в календарі" action={<Link href="/calendar" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">Календар →</Link>}>
              <ul className="space-y-1.5 text-sm">
                {soon.map((i) => (
                  <li key={i.date + i.title} className="flex gap-2">
                    <span className="w-16 shrink-0 text-xs tabular-nums text-zinc-500">{date(i.date).slice(0, 5)} · {daysUntil(i.date)} дн.</span>
                    <span className="min-w-0">{i.title}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={`Записи${inbox?.length ? ` · ${inbox.length}` : ""}`} action={!bot?.owner_chat_id ? <Link href="/bot" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">з Telegram →</Link> : undefined}>
            <form action={addInbox} className="flex gap-1.5">
              <input name="body" required placeholder="Думка, витрата, задача…" className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-white/15 dark:bg-zinc-950" />
              <button className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white" aria-label="Записати"><Icon name="plus" className="size-4" /></button>
            </form>
            {inbox && inbox.length > 0 ? (
              <ul className="mt-2 divide-y divide-black/[.06] dark:divide-white/5">
                {inbox.map((n) => (
                  <li key={n.id} className="flex items-start gap-2 py-1.5 text-sm">
                    <form action={inboxDone}>
                      <input type="hidden" name="id" value={n.id} />
                      <button className="mt-0.5 grid size-4 place-items-center rounded border border-black/25 hover:border-emerald-500 dark:border-white/25" aria-label="Опрацьовано" />
                    </form>
                    <span className="min-w-0 flex-1">
                      {n.body}
                      <span className="block text-xs text-zinc-500">{INBOX_KIND[n.kind] ?? "нотатка"} · {n.source === "telegram" ? "з Telegram" : "з сайту"} · {date(n.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Записуй сюди або боту в Telegram усе, що спало на думку. Відмічай, коли переніс у задачі чи фінанси.</p>
            )}
          </Card>

          <Card title="Корисне">
            <div className="grid gap-2 text-sm">
              <Link href="/sell" className="flex items-center gap-2 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-white/5"><Icon name="megaphone" className="size-4 text-indigo-500" /> Як продавати: канали, відгуки, реклама</Link>
              <Link href="/sell?s=simulator" className="flex items-center gap-2 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-white/5"><Icon name="calc" className="size-4 text-indigo-500" /> Симулятор: скільки заробиш або втратиш</Link>
              <Link href="/sell?s=texts" className="flex items-center gap-2 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-white/5"><Icon name="book" className="size-4 text-indigo-500" /> Готові тексти покупцям і постачальникам</Link>
              <Link href="/sell?s=slovnyk" className="flex items-center gap-2 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-white/5"><Icon name="bulb" className="size-4 text-indigo-500" /> Словник: ТТН, MOQ, CPA та інші слова</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
