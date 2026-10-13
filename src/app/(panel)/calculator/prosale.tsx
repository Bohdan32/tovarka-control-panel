"use client";

import { useState } from "react";
import { money, pct } from "@/lib/format";
import { inputCls } from "@/components/ui";

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      <input type="number" step="any" inputMode="decimal" value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Number(e.target.value))} className={inputCls} />
    </label>
  );
}

// Ставка за клік у Prom ProSale: замовлення коштує ціна кліку / конверсія. Вище CPA max — у мінус.
export function ProSale({ cpaMax }: { cpaMax: number }) {
  const [cpc, setCpc] = useState(4);
  const [conv, setConv] = useState(2);
  const [limit, setLimit] = useState(Math.round(cpaMax) || 250);
  const perOrder = conv > 0 ? cpc / (conv / 100) : null;
  const maxCpc = (limit * conv) / 100;
  const ok = perOrder !== null && perOrder <= limit;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-3 gap-2.5">
        <Num label="Ціна кліку, грн" value={cpc} onChange={setCpc} />
        <Num label="Конверсія, %" value={conv} onChange={setConv} />
        <Num label="CPA max, грн" value={limit} onChange={setLimit} />
      </div>
      <dl className="grid grid-cols-2 content-start gap-x-3 gap-y-1.5 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-white/5">
        <dt className="text-zinc-500">Замовлення коштує</dt>
        <dd className={`text-right text-lg font-semibold tabular-nums ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>{money(perOrder)}</dd>
        <dt className="text-zinc-500">Максимальна ставка</dt><dd className="text-right tabular-nums">{money(maxCpc)} за клік</dd>
        <dd className="col-span-2 text-xs text-zinc-500">
          {ok ? "Ставка в плюсі." : "Ставка з’їдає весь прибуток: знизь її або підніми конверсію (фото, ціна, відгуки)."} Конверсія новачка зазвичай 1–3%: з 100 кліків 1–3 замовлення. Реальну бери з кабінету Prom через тиждень ({pct(conv / 100)} зараз).
        </dd>
      </dl>
    </div>
  );
}
