import Link from "next/link";
import { ideaToTask, setIdeaStatus } from "@/app/(panel)/actions";

export const AREAS: Record<string, string> = {
  daily: "Щоденна робота",
  product: "Пошук товару",
  supply: "Постачання",
  price: "Ціни",
  sell: "Продажі",
  chat: "Чати",
  ship: "Доставка",
  ads: "Реклама",
  money: "Гроші і ФОП",
  auto: "Аналітик",
  ui: "Зручність",
  risk: "Ризики",
  learn: "Навчання",
  grow: "Масштаб",
};
export const PHASES: Record<string, string> = { now: "до запуску", launch: "перші продажі", grow: "масштаб" };
const EFFORT: Record<number, string> = { 1: "години", 2: "1–3 дні", 3: "тиждень+" };
const STATUSES: [status: string, label: string][] = [
  ["want", "Хочу"],
  ["doing", "В роботі"],
  ["done", "Готово"],
  ["skip", "Не треба"],
];

export type Idea = {
  id: string; area: string; phase: string; title: string; why: string | null; catch: string | null;
  impact: number; effort: number; cost: string | null; status: string; top: number | null; task_id: string | null;
};

const dots = (n: number) => "●".repeat(n) + "○".repeat(3 - n);
export const value = (i: Idea) => i.impact * 2 - i.effort;

export function IdeaCard({ i, showArea }: { i: Idea; showArea: boolean }) {
  return (
    <li className={`rounded-xl border bg-white p-3 dark:bg-zinc-900 ${i.status === "skip" ? "border-black/[.05] opacity-60 dark:border-white/5" : "border-black/[.07] dark:border-white/10"}`}>
      <div className="flex items-start gap-2">
        {i.top && <span className="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{i.top}</span>}
        <h3 className={`min-w-0 flex-1 text-sm font-semibold leading-snug ${i.status === "done" ? "text-zinc-500 line-through" : ""}`}>{i.title}</h3>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500">
        <span title="Ефект">ефект <span className="tracking-tight text-indigo-600 dark:text-indigo-400">{dots(i.impact)}</span></span>
        <span>роботи: {EFFORT[i.effort]}</span>
        {i.cost && <span>{i.cost}</span>}
        <span>{PHASES[i.phase]}</span>
        {showArea && <span className="text-zinc-400">{AREAS[i.area] ?? i.area}</span>}
      </div>
      {i.why && <p className="mt-1.5 text-[13px] leading-snug text-zinc-700 dark:text-zinc-300">{i.why}</p>}
      {i.catch && <p className="mt-1.5 text-xs leading-snug text-amber-700 dark:text-amber-400/90"><span className="font-medium">Підводний камінь: </span>{i.catch}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        {STATUSES.map(([s, label]) => (
          <form key={s} action={setIdeaStatus}>
            <input type="hidden" name="id" value={i.id} />
            <input type="hidden" name="status" value={i.status === s ? "new" : s} />
            <button type="submit" title={i.status === s ? "Зняти позначку" : label}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                i.status === s
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-black/10 text-zinc-600 hover:border-indigo-300 dark:border-white/10 dark:text-zinc-300"
              }`}>
              {label}
            </button>
          </form>
        ))}
        <span className="ml-auto">
          {i.task_id ? (
            <Link href="/plan#claude" className="text-xs text-emerald-600 hover:underline dark:text-emerald-400">у черзі Claude ✓</Link>
          ) : i.status !== "done" && i.status !== "skip" ? (
            <form action={ideaToTask}>
              <input type="hidden" name="id" value={i.id} />
              <button type="submit" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">→ Claude, зроби</button>
            </form>
          ) : null}
        </span>
      </div>
    </li>
  );
}

