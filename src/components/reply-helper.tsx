"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "@/components/copy";

type Tpl = { id: string; title: string; body: string };
type Prod = { name: string; price: number | null };

// Групи слів, які покупці пишуть про одне й те саме. Перші літери слова — щоб «доставка»,
// «доставку» і «доставки» збігались.
const SYNONYMS = [
  ["скільки", "ціна", "цін", "кошт", "дорог", "дешев", "знижк", "уступ"],
  ["доставк", "відправ", "пошт", "коли", "прийде", "дійде", "ттн", "трек", "відстеж", "затрим"],
  ["наявн", "є ще", "залиш", "закінч", "немає"],
  ["оплат", "наклад", "післяплат", "передоплат", "картк", "рахун", "реквізит"],
  ["поверн", "обмін", "не підійш", "розмір"],
  ["брак", "злам", "пошкодж", "трісн", "не працю"],
  ["подзвон", "дзвін", "телефон", "передзвон"],
  ["замов", "оформ", "куп", "беру"],
  ["відгук", "оцінк"],
  ["подума", "пізніше", "потім"],
];

const stem = (w: string) => w.slice(0, 5);
const words = (t: string) => t.toLowerCase().match(/[\p{L}\d]{3,}/gu) ?? [];

function expand(q: string) {
  const text = q.toLowerCase();
  const set = new Set(words(text).map(stem));
  for (const group of SYNONYMS) if (group.some((g) => text.includes(g))) group.forEach((g) => set.add(stem(g)));
  return set;
}

function score(t: Tpl, q: Set<string>) {
  let s = 0;
  for (const w of new Set(words(t.title).map(stem))) if (q.has(w)) s += 3;
  for (const w of new Set(words(t.body).map(stem))) if (q.has(w)) s += 1;
  return s;
}

export function ReplyHelper({ templates, products }: { templates: Tpl[]; products: Prod[] }) {
  const [q, setQ] = useState("");
  const [pi, setPi] = useState(0);
  const prod = products[pi];
  const fill = (body: string) =>
    body
      .replaceAll("{товар}", prod?.name.toLowerCase() ?? "{товар}")
      .replaceAll("{ціна}", prod?.price ? `${Math.round(prod.price)} грн` : "{ціна}");
  const best = useMemo(() => {
    if (q.trim().length < 3) return [];
    const set = expand(q);
    return templates
      .map((t) => ({ t, s: score(t, set) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
  }, [q, templates]);

  return (
    <div className="space-y-2">
      <textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        rows={2}
        placeholder="Встав сюди питання покупця, напр. «а коли буде доставка і чи можна оплатити на пошті?»"
        className="w-full rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-white/15 dark:bg-zinc-950"
      />
      {products.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          Товар:
          <select value={pi} onChange={(e) => setPi(Number(e.target.value))} className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-1.5 py-1 text-xs dark:border-white/15 dark:bg-zinc-950">
            {products.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
          </select>
        </label>
      )}
      {q.trim().length >= 3 && !best.length && (
        <p className="text-xs text-zinc-500">Готової відповіді немає. Запиши питання в банк нижче: аналітик допише відповідь.</p>
      )}
      {best.map(({ t }, i) => (
        <div key={t.id} className={`rounded-lg border p-2.5 ${i === 0 ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-500/40 dark:bg-indigo-500/10" : "border-black/[.07] dark:border-white/10"}`}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{i === 0 ? "Найкраще: " : ""}{t.title}</span>
            <CopyButton text={fill(t.body)} />
          </div>
          <p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">{fill(t.body)}</p>
        </div>
      ))}
    </div>
  );
}
