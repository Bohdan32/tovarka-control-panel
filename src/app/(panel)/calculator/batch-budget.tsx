"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import { inputCls } from "@/components/ui";

export type BudgetOffer = { id: string; name: string; landed: number; moq: number | null; cpa: number; profit: number };

const FIRST_ORDERS = 30;

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      <input type="number" step="any" inputMode="decimal" value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Number(e.target.value))} className={inputCls} />
    </label>
  );
}

// Скільки штук брати, щоб лишились гроші на рекламу перших 30 продажів і запас на відмови й зразки.
export function BatchBudget({ offers, riskLimit, defaultCpa }: { offers: BudgetOffer[]; riskLimit: number; defaultCpa: number }) {
  const [budget, setBudget] = useState(30000);
  const [pick, setPick] = useState(offers[0]?.id ?? "");
  const preset = offers.find((o) => o.id === pick);
  const [landed, setLanded] = useState(preset?.landed ?? 200);
  const [moq, setMoq] = useState(preset?.moq ?? 100);
  const [cpa, setCpa] = useState(preset?.cpa ?? defaultCpa);
  const [profit, setProfit] = useState(preset?.profit ?? 150);

  const choose = (id: string) => {
    setPick(id);
    const o = offers.find((x) => x.id === id);
    if (o) { setLanded(Math.round(o.landed)); setMoq(o.moq ?? 0); setCpa(Math.round(o.cpa)); setProfit(Math.round(o.profit)); }
  };

  const usable = Math.min(budget, riskLimit);
  const ads = Math.max(cpa * FIRST_ORDERS, usable * 0.2);
  const reserve = usable * 0.1;
  const forGoods = Math.max(usable - ads - reserve, 0);
  const units = landed > 0 ? Math.floor(forGoods / landed) : 0;
  const short = moq > 0 && units < moq ? moq * landed + ads + reserve - usable : 0;
  // Кожен продаж повертає собівартість, рекламу (вже закладену в бюджет) і прибуток.
  const payback = landed + cpa + profit > 0 ? Math.ceil((units * landed + ads) / (landed + cpa + profit)) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-2.5">
        {offers.length > 0 && (
          <label className="col-span-2 block text-sm">
            <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Товар (підставить цифри з пропозиції)</span>
            <select value={pick} onChange={(e) => choose(e.target.value)} className={inputCls}>
              {offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        )}
        <Num label="Скільки маєш грошей, грн" value={budget} onChange={setBudget} />
        <Num label="Собівартість штуки, грн" value={landed} onChange={setLanded} />
        <Num label="MOQ постачальника, шт" value={moq} onChange={setMoq} />
        <Num label="CPA, грн" value={cpa} onChange={setCpa} />
        <Num label="Прибуток з продажу, грн" value={profit} onChange={setProfit} />
      </div>
      <dl className="grid grid-cols-2 content-start gap-x-3 gap-y-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-white/5">
        {budget > riskLimit && (
          <dd className="col-span-2 text-amber-700 dark:text-amber-400">Ліміт ризику на один товар — {money(riskLimit)} (Налаштування). Решту тримай на другий товар.</dd>
        )}
        <dt className="text-zinc-500">Реклама на перші {FIRST_ORDERS} продажів</dt><dd className="text-right tabular-nums">{money(ads)}</dd>
        <dt className="text-zinc-500">Запас: відмови, зразки, брак</dt><dd className="text-right tabular-nums">{money(reserve)}</dd>
        <dt className="text-zinc-500">На товар</dt><dd className="text-right tabular-nums">{money(forGoods)}</dd>
        <dt className="text-zinc-500">Замовляй</dt>
        <dd className={`text-right text-xl font-semibold tabular-nums ${short ? "text-red-600" : "text-indigo-600 dark:text-indigo-400"}`}>{units} шт</dd>
        {short > 0 ? (
          <dd className="col-span-2 text-red-600">Не вистачає на MOQ {moq} шт: бракує {money(short)}. Домовляйся про меншу пробну партію або бери інший товар.</dd>
        ) : (
          <>
            <dt className="text-zinc-500">Продажів, щоб повернути все</dt><dd className="text-right tabular-nums">{payback ?? "—"}{payback !== null && units > 0 && ` з ${units}`}</dd>
            <dt className="text-zinc-500">Прибуток, якщо продаси все</dt><dd className="text-right tabular-nums">{money(units * profit)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
