import type { Part } from "@/lib/score";

// Смужки складників оцінки і підказка, що перевірити першим.
export function ScoreBars({ parts }: { parts: Part[] }) {
  const known = parts.filter((p) => p.value !== null);
  const weakest = [...parts].sort((a, b) => (a.value ?? -1) - (b.value ?? -1))[0];
  return (
    <div>
      <ul className="space-y-1.5">
        {parts.map((p) => (
          <li key={p.key} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{p.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
              {p.value !== null && (
                <span
                  className={`block h-full rounded-full ${p.value >= 0.66 ? "bg-emerald-500" : p.value >= 0.4 ? "bg-amber-400" : "bg-red-500"}`}
                  style={{ width: `${Math.max(p.value * 100, 4)}%` }}
                />
              )}
            </span>
            <span className="text-right text-xs tabular-nums text-zinc-500">{p.value === null ? "?" : Math.round(p.value * 10)}</span>
          </li>
        ))}
      </ul>
      {weakest && (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">Що перевірити: </span>{weakest.hint}
        </p>
      )}
      {known.length < parts.length && <p className="mt-1 text-[11px] text-zinc-400">«?» — даних ще немає, аналітик доповнить.</p>}
    </div>
  );
}
