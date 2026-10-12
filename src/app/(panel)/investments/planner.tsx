"use client";

import { useState } from "react";
import { money } from "@/lib/format";

export type PlanOffer = {
  offer_id: string; product_name: string; supplier_name: string | null; landed_cost_uah: number;
  price_uah: number; cpa_uah: number; refusal_reserve_uah: number; fee_pct: number; moq: number | null;
};

const SCENARIOS = [
  { key: "pess", label: "Песиміст", sell: 0.5, cpa: 1.5 },
  { key: "base", label: "База", sell: 0.8, cpa: 1 },
  { key: "opt", label: "Оптиміст", sell: 1, cpa: 0.75 },
];

export function Planner({ offers }: { offers: PlanOffer[] }) {
  const [id, setId] = useState(offers[0]?.offer_id ?? "");
  const o = offers.find((x) => x.offer_id === id);
  const [qty, setQty] = useState(o?.moq ?? 50);
  const [testAds, setTestAds] = useState(3000);
  const [extra, setExtra] = useState(1000);

  if (!o) return <p className="text-sm text-zinc-500">Спочатку додай товар і пропозицію постачальника.</p>;

  const stock = qty * o.landed_cost_uah;
  const capital = stock + testAds + extra;
  const perSale = (cpaFactor: number) => o.price_uah * (1 - o.fee_pct) - o.refusal_reserve_uah - o.cpa_uah * cpaFactor;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Пропозиція</span>
          <select value={id} onChange={(e) => setId(e.target.value)}
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-950">
            {offers.map((x) => (
              <option key={x.offer_id} value={x.offer_id}>{x.product_name} · {x.supplier_name ?? "—"}</option>
            ))}
          </select>
        </label>
        {[
          ["Партія, шт", qty, setQty],
          ["Тестова реклама, грн", testAds, setTestAds],
          ["Інше (лендінг, зразки), грн", extra, setExtra],
        ].map(([label, value, set]) => (
          <label key={label as string} className="block text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">{label as string}</span>
            <input type="number" value={value as number} onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-950" />
          </label>
        ))}
      </div>

      <p className="text-sm">
        Потрібно вкласти: <strong>{money(capital)}</strong> (товар {money(stock)}, реклама {money(testAds)}, інше {money(extra)}).
        {o.moq && qty < o.moq && <span className="text-red-600"> Партія менша за MOQ постачальника ({o.moq} шт).</span>}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase text-zinc-500 dark:border-white/10">
              <th className="px-2 py-2">Сценарій</th><th className="px-2 py-2">Продано</th><th className="px-2 py-2">З продажу</th>
              <th className="px-2 py-2">Результат партії</th><th className="px-2 py-2">Окупність, продажів</th>
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map((sc) => {
              const sold = Math.floor(qty * sc.sell);
              const each = perSale(sc.cpa);
              const result = sold * each - capital;
              const payback = each > 0 ? Math.ceil(capital / each) : null;
              return (
                <tr key={sc.key} className="border-b border-black/5 dark:border-white/5">
                  <td className="px-2 py-2 font-medium">{sc.label}</td>
                  <td className="px-2 py-2">{sold} з {qty}</td>
                  <td className="px-2 py-2">{money(each)}</td>
                  <td className={`px-2 py-2 font-semibold ${result < 0 ? "text-red-600" : "text-emerald-600"}`}>{money(result)}</td>
                  <td className="px-2 py-2">{payback === null ? "не окупиться" : payback > qty ? `${payback} (більше партії)` : payback}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">Песиміст: продано 50% партії, реклама на 50% дорожча. База: 80%. Оптиміст: уся партія, реклама на 25% дешевша.</p>
    </div>
  );
}
