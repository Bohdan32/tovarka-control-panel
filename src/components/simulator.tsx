"use client";

import { useMemo, useState } from "react";

export type SimProduct = { id: string; name: string; price: number | null; landed: number | null };

const SCENARIOS = [
  { key: "worst", label: "Погано", cpa: 300, refusal: 0.2, tone: "text-red-600 dark:text-red-400" },
  { key: "base", label: "Нормально", cpa: 150, refusal: 0.1, tone: "" },
  { key: "best", label: "Добре", cpa: 70, refusal: 0.05, tone: "text-emerald-600 dark:text-emerald-400" },
] as const;

const fmt = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 });
const uah = (v: number) => `${fmt.format(Math.round(v))} грн`;

function Num({ label, value, onChange, step = 1, suffix }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string;
}) {
  return (
    <label className="block text-xs text-zinc-600 dark:text-zinc-400">
      {label}
      <span className="mt-1 flex items-center rounded-lg border border-black/15 bg-white focus-within:border-indigo-500 dark:border-white/15 dark:bg-zinc-950">
        <input
          type="number" inputMode="decimal" step={step} value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full min-w-0 bg-transparent px-2.5 py-2 text-base text-zinc-900 outline-none sm:py-1.5 sm:text-sm dark:text-zinc-100"
        />
        {suffix && <span className="pr-2.5 text-zinc-400">{suffix}</span>}
      </span>
    </label>
  );
}

// Симулятор першого місяця тесту: скільки грошей піде і скільки повернеться в трьох сценаріях.
export function Simulator({ products, taxPct }: { products: SimProduct[]; taxPct: number }) {
  const [pick, setPick] = useState("");
  const [price, setPrice] = useState(599);
  const [landed, setLanded] = useState(190);
  const [qty, setQty] = useState(200);
  const [budget, setBudget] = useState(300);
  const [days, setDays] = useState(30);
  const [fee, setFee] = useState(10);
  const [cod, setCod] = useState(80);
  const [ret, setRet] = useState(180);
  const [ful, setFul] = useState(30);
  const [cpa, setCpa] = useState<number[]>(SCENARIOS.map((s) => s.cpa));
  const [refusal, setRefusal] = useState<number[]>(SCENARIOS.map((s) => s.refusal * 100));

  const choose = (id: string) => {
    setPick(id);
    const p = products.find((x) => x.id === id);
    if (p?.price) setPrice(Math.round(p.price));
    if (p?.landed) setLanded(Math.round(p.landed));
  };

  const rows = useMemo(() => SCENARIOS.map((s, i) => {
    const ads = budget * days;
    const orders = ads / Math.max(cpa[i], 1);
    const r = refusal[i] / 100;
    const sold = Math.min(orders * (1 - r), qty);
    const refused = Math.min(orders, qty / (1 - r)) * r;
    const revenue = sold * price;
    const fees = revenue * (fee / 100 + taxPct) + sold * (cod / 100) * (price * 0.02 + 20);
    const logistics = (sold + refused) * ful + refused * ret;
    const stock = qty * landed;
    const profitPerSold = sold ? (revenue - fees - logistics - ads - sold * landed) / sold : 0;
    const cash = revenue - fees - logistics - ads - stock;
    const left = Math.max(qty - sold, 0);
    return { s, ads, orders, sold, refused, revenue, fees, logistics, stock, profitPerSold, cash, left, month: revenue - fees - logistics - ads - sold * landed };
  }), [budget, days, cpa, refusal, qty, price, fee, taxPct, cod, ful, ret, landed]);

  const line = (label: string, get: (r: (typeof rows)[number]) => string, strong = false) => (
    <tr className="border-t border-black/[.06] dark:border-white/5">
      <td className="py-1.5 pr-2 text-zinc-500">{label}</td>
      {rows.map((r) => (
        <td key={r.s.key} className={`py-1.5 text-right tabular-nums ${strong ? `font-semibold ${r.s.tone}` : ""}`}>{get(r)}</td>
      ))}
    </tr>
  );

  return (
    <div className="space-y-4">
      {products.length > 0 && (
        <label className="block text-xs text-zinc-600 dark:text-zinc-400">
          Підставити товар з банку
          <select value={pick} onChange={(e) => choose(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/15 bg-white px-2.5 py-2 text-base text-zinc-900 sm:py-1.5 sm:text-sm dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-100">
            <option value="">— свої цифри —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <Num label="Ціна продажу" value={price} onChange={setPrice} suffix="грн" />
        <Num label="Собівартість на складі" value={landed} onChange={setLanded} suffix="грн" />
        <Num label="Партія" value={qty} onChange={setQty} suffix="шт" />
        <Num label="Реклама на день" value={budget} onChange={setBudget} step={50} suffix="грн" />
        <Num label="Днів реклами" value={days} onChange={setDays} />
      </div>

      <details className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-white/5">
        <summary className="cursor-pointer text-xs font-medium text-indigo-600 dark:text-indigo-400">Комісії, повернення і сценарії</summary>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Num label="Комісія майданчика" value={fee} onChange={setFee} suffix="%" />
          <Num label="Частка післяплати" value={cod} onChange={setCod} suffix="%" />
          <Num label="Відмова: дорога туди-назад" value={ret} onChange={setRet} suffix="грн" />
          <Num label="Фулфілмент за відправку" value={ful} onChange={setFul} suffix="грн" />
          {SCENARIOS.map((s, i) => (
            <div key={s.key} className="col-span-2 grid grid-cols-2 gap-2.5 sm:col-span-4 sm:grid-cols-4">
              <Num label={`${s.label}: ціна замовлення (CPA)`} value={cpa[i]} onChange={(v) => setCpa(cpa.map((x, j) => (j === i ? v : x)))} suffix="грн" />
              <Num label={`${s.label}: відмови`} value={refusal[i]} onChange={(v) => setRefusal(refusal.map((x, j) => (j === i ? v : x)))} suffix="%" />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Податок {Math.round(taxPct * 100)}% береться з Налаштувань. Післяплата Нової Пошти рахується як 2% + 20 грн. Сценарії — орієнтири, точні цифри покаже перший тиждень реклами.
        </p>
      </details>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="text-xs text-zinc-500">
              <th className="pb-1.5 text-left font-medium">За {days} днів</th>
              {rows.map((r) => <th key={r.s.key} className={`pb-1.5 text-right font-semibold ${r.s.tone}`}>{r.s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {line("Реклама", (r) => uah(r.ads))}
            {line("Замовлень", (r) => fmt.format(Math.round(r.orders)))}
            {line("Викуплено", (r) => `${fmt.format(Math.round(r.sold))} шт`)}
            {line("Відмов", (r) => fmt.format(Math.round(r.refused)))}
            {line("Виручка", (r) => uah(r.revenue))}
            {line("Комісії і податок", (r) => uah(r.fees))}
            {line("Склад, доставка, відмови", (r) => uah(r.logistics))}
            {line("Прибуток з проданого", (r) => uah(r.month), true)}
            {line("На одному продажу", (r) => uah(r.profitPerSold))}
            {line("Лишилось на складі", (r) => `${fmt.format(Math.round(r.left))} шт`)}
            {line("Гроші зараз (з партією)", (r) => uah(r.cash), true)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        «Гроші зараз» — скільки ти в плюсі чи мінусі з урахуванням того, що вся партія ({uah(qty * landed)}) уже оплачена. Залишок на складі ще можна продати.
      </p>
    </div>
  );
}
