import Link from "next/link";
import { deleteTask, setTaskStatus, updateTask } from "@/app/(panel)/actions";
import { Icon } from "./icons";
import { Badge, Button, Field, inputCls } from "./ui";
import { PRIORITIES, date, daysUntil, money } from "@/lib/format";

export type TaskRow = {
  id: string; title: string; details: string | null; status: string; priority: number;
  due_on: string | null; cost_uah: number | string | null; source: string; step_id: string | null;
  product_id: string | null; products?: { name: string } | null; playbook_steps?: { n: number; title: string } | null;
};

function StatusButton({ id, status, icon, title, active }: { id: string; status: string; icon: string; title: string; active?: boolean }) {
  return (
    <form action={setTaskStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" title={title} aria-label={title}
        className={`grid size-7 place-items-center rounded-lg border transition ${
          active
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-black/15 text-zinc-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-white/15"
        }`}>
        <Icon name={icon} className="size-3.5" />
      </button>
    </form>
  );
}

export function TaskItem({ t, showContext }: { t: TaskRow; showContext?: boolean }) {
  const done = t.status === "done" || t.status === "skipped";
  const left = daysUntil(t.due_on);
  return (
    <li className="flex items-start gap-2.5 py-2">
      <div className="flex shrink-0 gap-1 pt-0.5">
        {done ? (
          <StatusButton id={t.id} status="todo" icon="check" title="Повернути в роботу" active />
        ) : (
          <>
            <StatusButton id={t.id} status="done" icon="check" title="Готово" />
            {t.status !== "doing" && <StatusButton id={t.id} status="doing" icon="play" title="Взяти в роботу" />}
          </>
        )}
      </div>
      <details className="group min-w-0 flex-1">
        <summary className="cursor-pointer">
          <span className={`text-sm ${done ? "text-zinc-400 line-through" : ""}`}>{t.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            {t.status === "doing" && <Badge tone="blue">в роботі</Badge>}
            {t.priority === 1 && !done && <Badge tone="amber">важливо</Badge>}
            {t.source === "analyst" && <Badge tone="blue">аналітик</Badge>}
            {t.due_on && !done && (
              <Badge tone={left !== null && left < 0 ? "red" : left !== null && left <= 2 ? "amber" : "gray"}>
                до {date(t.due_on)}
              </Badge>
            )}
            {Number(t.cost_uah) > 0 && <span>{money(t.cost_uah)}</span>}
            {showContext && t.playbook_steps && <span>Крок {t.playbook_steps.n}. {t.playbook_steps.title}</span>}
            {showContext && t.products && t.product_id && (
              <Link href={`/products/${t.product_id}`} className="text-indigo-600 hover:underline dark:text-indigo-400">{t.products.name}</Link>
            )}
          </span>
        </summary>
        <div className="mt-2 space-y-2 rounded-lg bg-zinc-50 p-2.5 dark:bg-white/5">
          {t.details && <p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">{t.details}</p>}
          <form action={updateTask} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input type="hidden" name="id" value={t.id} />
            <div className="col-span-2"><Field label="Задача" name="title" defaultValue={t.title} required /></div>
            <Field label="Строк" name="due_on" type="date" defaultValue={t.due_on} />
            <Field label="Вартість, грн" name="cost_uah" type="number" defaultValue={t.cost_uah} />
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Пріоритет</span>
              <select name="priority" defaultValue={String(t.priority)} className={inputCls}>
                {Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="col-span-2 block text-sm sm:col-span-3">
              <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Деталі</span>
              <input name="details" defaultValue={t.details ?? ""} className={inputCls} />
            </label>
            <div className="col-span-2 flex items-center gap-2 sm:col-span-4"><Button variant="ghost">Зберегти</Button></div>
          </form>
          <div className="flex gap-2">
            {t.status !== "skipped" && (
              <form action={setTaskStatus}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="status" value="skipped" />
                <button className="text-xs text-zinc-500 hover:underline">Не потрібно</button>
              </form>
            )}
            <form action={deleteTask}>
              <input type="hidden" name="id" value={t.id} />
              <button className="text-xs text-red-600 hover:underline">Видалити</button>
            </form>
          </div>
        </div>
      </details>
    </li>
  );
}

export function TaskList({ tasks, showContext, empty = "Задач немає" }: { tasks: TaskRow[]; showContext?: boolean; empty?: string }) {
  if (!tasks.length) return <p className="py-3 text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="divide-y divide-black/[.05] dark:divide-white/5">
      {tasks.map((t) => <TaskItem key={t.id} t={t} showContext={showContext} />)}
    </ul>
  );
}

// Порядок: в роботі → високий пріоритет → строк → крок.
export function sortTasks<T extends TaskRow>(rows: T[]) {
  const rank = (s: string) => ({ doing: 0, todo: 1, done: 2, skipped: 3 })[s] ?? 4;
  return [...rows].sort((a, b) =>
    rank(a.status) - rank(b.status) ||
    a.priority - b.priority ||
    (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") ||
    (a.playbook_steps?.n ?? 99) - (b.playbook_steps?.n ?? 99),
  );
}
