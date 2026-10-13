"use client";

import { useState } from "react";
import { money, pct } from "@/lib/format";
import { inputCls } from "@/components/ui";

export type CalcSettings = {
  usd_rate: number; cargo_usd_per_kg: number; packaging_uah: number; fee_pct: number; tax_pct: number;
  target_margin: number; refusal_rate: number; return_shipping_uah: number; default_cpa_uah: number;
};

// Те саме, що представлення offer_economics у базі: комісії й податки беруться від ціни.
export function priceFor(s: CalcSettings, unitUsd: number, chinaUsd: number, weightKg: number, cpa: number, margin: number, cargo = s.cargo_usd_per_kg) {
  const cut = s.fee_pct + (s.tax_pct || 0);
  const landed = (unitUsd + chinaUsd + weightKg * cargo) * s.usd_rate + s.packaging_uah;
  const reserve = s.refusal_rate * s.return_shipping_uah;
  const price = Math.ceil((landed + cpa + reserve) / (1 - margin - cut));
  const profit = price * (1 - cut) - landed - cpa - reserve;
  const cpaMax = price * (1 - cut) - landed - reserve;
  return { landed, reserve, price, profit, cpaMax, cut };
}

function Input({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      <input type="number" step="any" inputMode="decimal" value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Number(e.target.value))}
        className={inputCls} />
    </label>
  );
}

const MARGINS = [0.2, 0.25, 0.3, 0.35, 0.4];
// Ставка за кг, дні в дорозі і скільки кг рахують за літр об'єму (легкий і об'ємний товар платить за об'єм).
const CARGO = [
  ["Море", 1.5, "60–75 дн.", 0.2],
  ["Залізниця", 3, "40–55 дн.", 0.2],
  ["Авто", 5, "25–35 дн.", 0.2],
  ["Авіа", 9, "12–20 дн.", 0.167],
] as const;

export function QuickCalc({ settings }: { settings: CalcSettings }) {
  const [unit, setUnit] = useState(4);
  const [china, setChina] = useState(0.5);
  const [weight, setWeight] = useState(0.4);
  const [volume, setVolume] = useState(0);
  const chargeable = (perLitre: number) => Math.max(weight, volume * perLitre);
  const [cpa, setCpa] = useState(Number(settings.default_cpa_uah));
  const [margin, setMargin] = useState(Number(settings.target_margin) * 100);
  const [market, setMarket] = useState(0);
  const [batch, setBatch] = useState(200);
  const r = priceFor(settings, unit, china, weight, cpa, margin / 100);
  const tooExpensive = market > 0 && r.price > market;
  const atMarket = market > 0 ? market * (1 - r.cut) - r.landed - cpa - r.reserve : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-2.5">
          <Input label="Ціна товару, $" value={unit} onChange={setUnit} />
          <Input label="Доставка по Китаю, $" value={china} onChange={setChina} />
          <Input label="Вага, кг" value={weight} onChange={setWeight} />
          <Input label="CPA (реклама на продаж), грн" value={cpa} onChange={setCpa} />
          <Input label="Цільова маржа, %" value={margin} onChange={setMargin} />
          <Input label="Медіана ринку, грн" value={market} onChange={setMarket} />
          <Input label="Партія, шт" value={batch} onChange={setBatch} />
          <Input label="Об’єм упаковки, л (не обов’язково)" value={volume} onChange={setVolume} />
        </div>
        <dl className="grid grid-cols-2 content-start gap-x-3 gap-y-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-white/5">
          <dt className="text-zinc-500">Собівартість до складу</dt><dd className="text-right font-semibold tabular-nums">{money(r.landed)}</dd>
          <dt className="text-zinc-500">Резерв на відмови</dt><dd className="text-right tabular-nums">{money(r.reserve)}</dd>
          <dt className="text-zinc-500">Комісії + податки</dt><dd className="text-right tabular-nums">{pct(r.cut)} = {money(r.price * r.cut)}</dd>
          <dt className="text-zinc-500">Рекомендована ціна</dt>
          <dd className={`text-right text-xl font-semibold tabular-nums ${tooExpensive ? "text-red-600" : "text-indigo-600 dark:text-indigo-400"}`}>{money(r.price)}</dd>
          <dt className="text-zinc-500">Прибуток з продажу</dt><dd className="text-right tabular-nums">{money(r.profit)} ({pct(r.profit / r.price)})</dd>
          <dt className="text-zinc-500">CPA max</dt><dd className="text-right tabular-nums">{money(r.cpaMax)}</dd>
          <dt className="text-zinc-500">Гроші в партію</dt><dd className="text-right tabular-nums">{money(r.landed * batch)}</dd>
          <dt className="text-zinc-500">Прибуток з партії</dt><dd className="text-right tabular-nums">{money(r.profit * batch)}</dd>
          {atMarket !== null && (
            <>
              <dt className="text-zinc-500">Якщо продавати за медіаною</dt>
              <dd className={`text-right tabular-nums ${atMarket < 0 ? "text-red-600" : ""}`}>{money(atMarket)} ({pct(atMarket / market)})</dd>
            </>
          )}
          {tooExpensive && (
            <dd className="col-span-2 text-red-600">Дорожче за ринок: шукай дешевшого постачальника, дешевшу доставку або відкидай товар.</dd>
          )}
        </dl>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">Варіанти: маржа × спосіб доставки</h3>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[30rem] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs text-zinc-500 dark:border-white/10">
                <th className="px-2 py-1.5 font-medium">Маржа</th>
                {CARGO.map(([l, v, days]) => <th key={l} className="px-2 py-1.5 font-medium">{l} ${v}/кг<span className="block font-normal">{days}</span></th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[.05] dark:divide-white/5">
              {MARGINS.map((m) => (
                <tr key={m}>
                  <td className="px-2 py-1.5 font-medium">{pct(m)}</td>
                  {CARGO.map(([l, v, , perLitre]) => {
                    const x = priceFor(settings, unit, china, chargeable(perLitre), cpa, m, v);
                    const over = market > 0 && x.price > market;
                    return (
                      <td key={l} className={`px-2 py-1.5 ${over ? "text-red-600" : ""}`}>
                        {money(x.price)} <span className="text-xs text-zinc-500">+{money(x.profit)}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Ціна продажу і прибуток з одного продажу. Червоне — дорожче медіани ринку. Ставки доставки — орієнтири з джерел, свою ставку задай у Налаштуваннях. Якщо вказати об’єм, легкий і великий товар рахується за об’ємом, як у карго.</p>
      </div>
    </div>
  );
}
