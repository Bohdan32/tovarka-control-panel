import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { createTask } from "../actions";
import { AddForm, Badge, Button, Card, Field, FormGrid, PageHeader, Pills, Progress, Select, Stat, Stats } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { TaskList, sortTasks, type TaskRow } from "@/components/tasks";
import { PRIORITIES, compact, money, range } from "@/lib/format";

export const metadata: Metadata = { title: "План і задачі" };

const FILTERS: Record<string, (t: TaskRow) => boolean> = {
  open: (t) => t.status === "todo" || t.status === "doing",
  doing: (t) => t.status === "doing",
  done: (t) => t.status === "done" || t.status === "skipped",
  analyst: (t) => t.source === "analyst",
  all: () => true,
};

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const { show } = await searchParams;
  const filter = typeof show === "string" && show in FILTERS ? show : "open";
  const { supabase } = await requireMember();
  const [{ data: steps }, { data: rows }, products] = await Promise.all([
    supabase.from("playbook_steps").select("*").order("n"),
    supabase.from("tasks").select("*, products(name), playbook_steps(n, title)").order("sort"),
    productOptions(supabase),
  ]);

  const tasks = (rows ?? []) as (TaskRow & { sort: number })[];
  const closed = (t: TaskRow) => t.status === "done" || t.status === "skipped";
  const doneCount = tasks.filter(closed).length;
  const open = tasks.filter((t) => !closed(t));
  const openCost = open.reduce((a, t) => a + Number(t.cost_uah ?? 0), 0);
  const urgent = open.filter((t) => t.priority === 1).length;
  const budgetMin = (steps ?? []).reduce((a, s) => a + Number(s.cost_min_uah ?? 0), 0);
  const budgetMax = (steps ?? []).reduce((a, s) => a + Number(s.cost_max_uah ?? 0), 0);
  const daysMax = (steps ?? []).reduce((a, s) => a + Number(s.days_max ?? 0), 0);
  const visible = tasks.filter(FILTERS[filter]);
  const firstOpenStep = (steps ?? []).find((s) => tasks.some((t) => t.step_id === s.id && !closed(t)))?.id;
  const loose = sortTasks(visible.filter((t) => !t.step_id));

  return (
    <div className="space-y-4">
      <PageHeader title="План і задачі" subtitle="Крок за кроком від ФОП до перших продажів. Відмічай задачі тут, аналітик додає нові." />

      <Stats>
        <Stat label="Виконано" value={`${doneCount} / ${tasks.length}`} hint={`${Math.round((doneCount / Math.max(tasks.length, 1)) * 100)}% плану`} tone={doneCount === tasks.length && tasks.length ? "good" : undefined} />
        <Stat label="В роботі" value={tasks.filter((t) => t.status === "doing").length} href="/plan?show=doing" />
        <Stat label="Важливих відкритих" value={urgent} tone={urgent ? "warn" : "good"} />
        <Stat label="Бюджет запуску" value={range(budgetMin, budgetMax)} hint="сума кроків" />
        <Stat label="Витрати відкритих задач" value={money(openCost)} />
        <Stat label="Час до продажів" value={`до ${daysMax} дн.`} hint="кроки йдуть частково паралельно" />
      </Stats>

      <Pills
        active={filter === "open" ? "/plan" : `/plan?show=${filter}`}
        items={[
          ["/plan", "Відкриті", open.length],
          ["/plan?show=doing", "В роботі", tasks.filter(FILTERS.doing).length],
          ["/plan?show=done", "Готові", doneCount],
          ["/plan?show=analyst", "Від аналітика", tasks.filter(FILTERS.analyst).length],
          ["/plan?show=all", "Усі", tasks.length],
        ]}
      />

      <div className="space-y-2.5">
        {(steps ?? []).map((s) => {
          const all = tasks.filter((t) => t.step_id === s.id);
          const stepDone = all.filter(closed).length;
          const shown = sortTasks(visible.filter((t) => t.step_id === s.id));
          const complete = all.length > 0 && stepDone === all.length;
          return (
            <details key={s.id} id={`step-${s.n}`} open={s.id === firstOpenStep} className="group rounded-xl border border-black/[.07] bg-white dark:border-white/10 dark:bg-zinc-900">
              <summary className="flex cursor-pointer items-center gap-3 p-3 sm:p-4">
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${complete ? "bg-emerald-500 text-white" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"}`}>
                  {complete ? "✓" : s.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{s.title}</span>
                    <span className="text-xs text-zinc-500">{s.goal}</span>
                  </span>
                  <span className="mt-1.5 flex items-center gap-3">
                    <span className="w-24 sm:w-40"><Progress value={stepDone / Math.max(all.length, 1)} tone={complete ? "green" : "indigo"} /></span>
                    <span className="text-xs tabular-nums text-zinc-500">{stepDone}/{all.length}</span>
                    <span className="hidden text-xs text-zinc-500 sm:inline">{range(s.cost_min_uah, s.cost_max_uah)} · {s.days_min}–{s.days_max} дн.</span>
                  </span>
                </span>
                <span className="text-zinc-400 transition group-open:rotate-90">›</span>
              </summary>
              <div className="grid gap-4 border-t border-black/[.07] p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] dark:border-white/10">
                <div>
                  <div className="mb-2 flex flex-wrap gap-1.5 sm:hidden">
                    <Badge>{range(s.cost_min_uah, s.cost_max_uah)}</Badge>
                    <Badge>{s.days_min}–{s.days_max} дн.</Badge>
                  </div>
                  <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Задачі</h3>
                  <TaskList tasks={shown} empty={all.length ? "У цьому фільтрі нічого" : "Задач немає"} />
                </div>
                {s.body && (
                  <div className="min-w-0 rounded-lg bg-zinc-50 p-3 dark:bg-white/5">
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Як і варіанти</h3>
                    <Markdown text={s.body} />
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>

      {loose.length > 0 && (
        <Card title={`Інші задачі · ${loose.length}`}>
          <TaskList tasks={loose} showContext />
        </Card>
      )}

      <AddForm title="Нова задача">
        <form action={createTask} className="space-y-2.5">
          <FormGrid>
            <div className="col-span-2"><Field label="Що зробити" name="title" required /></div>
            <Select label="Крок плану" name="step_id" includeEmpty="—" options={(steps ?? []).map((s) => [s.id, `${s.n}. ${s.title}`] as [string, string])} />
            <Select label="Товар" name="product_id" includeEmpty="—" options={products} />
            <Select label="Пріоритет" name="priority" options={PRIORITIES} defaultValue="2" />
            <Field label="Строк" name="due_on" type="date" />
            <Field label="Вартість, грн" name="cost_uah" type="number" />
            <Field label="Деталі" name="details" />
          </FormGrid>
          <Button>Додати задачу</Button>
        </form>
      </AddForm>

      <p className="text-xs text-zinc-500">
        Цифри кроків з джерел станом на жовтень 2026, повний список — у розділі <a href="/sources" className="text-indigo-600 hover:underline dark:text-indigo-400">Джерела</a>.
        Бюджет плану {compact(budgetMin)}–{compact(budgetMax)} грн — орієнтир на один товар.
      </p>
    </div>
  );
}
