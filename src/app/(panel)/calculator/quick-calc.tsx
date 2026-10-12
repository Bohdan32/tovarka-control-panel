"use client";

import { useState } from "react";
import { money, pct } from "@/lib/format";

export type CalcSettings = {
  usd_rate: number; cargo_usd_per_kg: number; packaging_uah: number; fee_pct: number;
  target_margin: number; refusal_rate: number; return_shipping_uah: number; default_cpa_uah: number;
};

export function priceFor(s: CalcSettings, unitUsd: number, chinaUsd: number, weightKg: number, cpa: number, margin: number) {
  const landed = (unitUsd + chinaUsd + weightKg * s.cargo_usd_per_kg) * s.usd_rate + s.packaging_uah;
  const reserve = s.refusal_rate * s.return_shipping_uah;
  const price = Math.ceil((landed + cpa + reserve) / (1 - margin - s.fee_pct));
  const profit = price * (1 - s.fee_pct) - landed - cpa - reserve;
  const cpaMax = price * (1 - s.fee_pct) - landed - reserve;
  return { landed, reserve, price, profit, cpaMax };
}

function Input({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-600 dark:text-zinc-400">{label}</span>
      <input type="number" step="any" value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-zinc-950" />
    </label>
  );
}

export function QuickCalc({ settings }: { settings: CalcSettings }) {
  const [unit, setUnit] = useState(4);
  const [china, setChina] = useState(0.5);
  const [weight, setWeight] = useState(0.4);
  const [cpa, setCpa] = useState(Number(settings.default_cpa_uah));
  const [margin, setMargin] = useState(Number(settings.target_margin) * 100);
  const [market, setMarket] = useState(0);
  const r = priceFor(settings, unit, china, weight, cpa, margin / 100);
  const tooExpensive = market > 0 && r.price > market;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Ціна товару, $" value={unit} onChange={setUnit} />
        <Input label="Доставка по Китаю, $" value={china} onChange={setChina} />
        <Input label="Вага, кг" value={weight} onChange={setWeight} />
        <Input label="CPA (реклама на продаж), грн" value={cpa} onChange={setCpa} />
        <Input label="Цільова маржа, %" value={margin} onChange={setMargin} />
        <Input label="Медіана ринку, грн (необов’язково)" value={market} onChange={setMarket} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt className="text-zinc-500">Собівартість до складу</dt><dd className="font-semibold">{money(r.landed)}</dd>
        <dt className="text-zinc-500">Резерв на відмови</dt><dd>{money(r.reserve)}</dd>
        <dt className="text-zinc-500">Рекомендована ціна</dt>
        <dd className={`text-xl font-semibold ${tooExpensive ? "text-red-600" : ""}`}>{money(r.price)}</dd>
        <dt className="text-zinc-500">Прибуток з продажу</dt><dd>{money(r.profit)} ({pct(r.profit / r.price)})</dd>
        <dt className="text-zinc-500">CPA max</dt><dd>{money(r.cpaMax)}</dd>
        {tooExpensive && (
          <dd className="col-span-2 text-red-600">Дорожче за ринок: шукай дешевшого постачальника або відкидай товар.</dd>
        )}
      </dl>
    </div>
  );
}
