import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { createBatch, updateBatch } from "../actions";
import type { Metadata } from "next";
import { AddForm, Badge, Button, Card, Field, FormGrid, PageHeader, Select, Stat, Stats, Table, Td, miniInput } from "@/components/ui";
import { BATCH_STAGES, date, money } from "@/lib/format";
import { daysAgoIso } from "@/lib/orders";

export const metadata: Metadata = { title: "Склад" };

export default async function InventoryPage() {
  const { supabase } = await requireMember();
  const since = daysAgoIso(30);
  const today = daysAgoIso(0).slice(0, 10);
  const [stock, batches, products, { data: sold }, { data: settings }, { data: plans }] = await Promise.all([
    supabase.from("product_stock").select("*").or("in_stock.neq.0,incoming.neq.0"),
    supabase.from("inventory_batches").select("*, products(name)").order("ordered_on", { ascending: false }),
    productOptions(supabase),
    supabase.from("orders").select("product_id, qty").in("status", ["confirmed", "shipped", "delivered"]).gte("created_at", since),
    supabase.from("cost_settings").select("lead_days").eq("id", 1).single(),
    supabase.from("offer_economics").select("product_id, landed_cost_uah, is_selected").order("is_selected", { ascending: false }),
  ]);
  // Планова собівартість з вибраної пропозиції, щоб порівняти з фактом партії.
  const planned = new Map<string, number>();
  for (const o of plans ?? []) if (o.product_id && !planned.has(o.product_id)) planned.set(o.product_id, Number(o.landed_cost_uah));
  // Старі партії мали лише статус: показуємо відповідний етап.
  const stageOf = (b: { stage: string | null; status: string }) =>
    b.status === "arrived" ? "fulfillment" : b.status === "in_transit" && (!b.stage || b.stage === "paid") ? "transit" : b.stage ?? "paid";
  // Точка дозамовлення: продажі за день × (доставка партії + 14 днів запасу).
  const lead = Number(settings?.lead_days ?? 55);
  const perDay = new Map<string, number>();
  for (const o of sold ?? []) perDay.set(o.product_id, (perDay.get(o.product_id) ?? 0) + o.qty / 30);
  const reorder = (s: { product_id: string | null; in_stock: number | null; incoming: number | null }) => {
    const rate = perDay.get(s.product_id ?? "") ?? 0;
    if (!rate) return null;
    const left = (Number(s.in_stock) + Number(s.incoming)) / rate;
    return { rate, left: Math.floor(left), now: left <= lead + 14, point: Math.ceil(rate * (lead + 14)) };
  };
  const toOrder = (stock.data ?? []).filter((s) => reorder(s)?.now);
  // Залежалий товар: лежить на складі понад 30 днів і за місяць жодного продажу.
  const arrivedLong = new Set((batches.data ?? []).filter((b) => b.status === "arrived" && b.arrived_on && b.arrived_on <= since.slice(0, 10)).map((b) => b.product_id));
  const stale = (stock.data ?? []).filter((s) => Number(s.in_stock) > 0 && !perDay.get(s.product_id ?? "") && arrivedLong.has(s.product_id));

  const all = batches.data ?? [];
  const units = (stock.data ?? []).reduce((a, s) => a + Number(s.in_stock), 0);
  const incoming = (stock.data ?? []).reduce((a, s) => a + Number(s.incoming), 0);
  const spent = all.reduce((a, b) => a + Number(b.total_cost_uah), 0);
  const low = (stock.data ?? []).filter((s) => Number(s.in_stock) <= 5).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Склад і закупівлі" subtitle="Залишок = партії на складі мінус підтверджені, відправлені й отримані замовлення." />
      <Stats>
        <Stat label="На складі" value={`${units} шт`} />
        <Stat label="В дорозі" value={`${incoming} шт`} />
        <Stat label="Партій" value={all.length} />
        <Stat label="Вкладено в партії" value={money(spent)} />
        <Stat label="Середня за од." value={money(all.length ? spent / Math.max(all.reduce((a, b) => a + b.qty, 0), 1) : null)} />
        <Stat label="Закінчуються" value={low} tone={low ? "warn" : "good"} hint="≤ 5 шт" />
      </Stats>
      {toOrder.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <b>Пора замовляти:</b> {toOrder.map((s) => s.name).join(", ")}. Товару вистачить менше, ніж їде нова партія ({lead} дн.) плюс 2 тижні запасу.
        </div>
      )}
      {stale.length > 0 && (
        <Card title={`Залежалось · ${stale.map((s) => s.name).join(", ")}`}>
          <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">За 30 днів жодного продажу. Гроші в залишках заморожені — розморожуй по черзі:</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Перевір картку: фото, назву й ціну проти конкурентів (картка товару → «Якість картки»).</li>
            <li>Зроби комплект із ходовим товаром або «2 шт зі знижкою».</li>
            <li>Виклади на OLX і в тематичні групи — це безкоштовно.</li>
            <li>Акція −15–20% на тиждень, але не нижче мінімальної ціни з картки товару.</li>
            <li>Не продається і після акції — продай оптом іншим продавцям за собівартість і не замовляй більше.</li>
          </ol>
        </Card>
      )}
      <Card title="Залишки">
        <Table head={["Товар", "На складі", "В дорозі", "Продаж/день", "Вистачить", "Дозамовлення"]} empty={!stock.data?.length}>
          {stock.data?.map((s) => {
            const r = reorder(s);
            return (
              <tr key={s.product_id}>
                <Td>{s.name}</Td>
                <Td><Badge tone={Number(s.in_stock) <= 5 ? "red" : "green"}>{s.in_stock}</Badge></Td>
                <Td>{s.incoming}</Td>
                <Td>{r ? r.rate.toFixed(1) : "—"}</Td>
                <Td>{r ? `${r.left} дн.` : "—"}</Td>
                <Td>{r ? (r.now ? <Badge tone="amber">замовляй зараз</Badge> : `при ${r.point} шт`) : <span className="text-xs text-zinc-500">після перших продажів</span>}</Td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <Card title="Партії: де зараз товар">
        {!all.length && <p className="text-sm text-zinc-500">Ще немає партій. Додай першу після оплати постачальнику.</p>}
        <div className="space-y-3">
          {all.map((b) => {
            const stage = stageOf(b);
            const idx = BATCH_STAGES.findIndex(([k]) => k === stage);
            const unit = Number(b.total_cost_uah) / Math.max(b.qty, 1);
            const plan = planned.get(b.product_id);
            const diff = plan ? (unit - plan) / plan : null;
            const late = b.eta_on && stage !== "fulfillment" && b.eta_on < today;
            return (
              <div key={b.id} className="rounded-lg border border-black/[.07] p-3 dark:border-white/10">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="font-medium">{b.products?.name} · {b.qty} шт</div>
                  <div className="text-xs text-zinc-500">
                    замовлено {date(b.ordered_on)}
                    {b.eta_on && stage !== "fulfillment" && <> · <span className={late ? "font-medium text-red-600" : ""}>{late ? "запізнюється, мала бути" : "очікуємо"} {date(b.eta_on)}</span></>}
                    {b.arrived_on && <> · прийшла {date(b.arrived_on)}</>}
                  </div>
                </div>
                <ol className="my-2 flex gap-1">
                  {BATCH_STAGES.map(([k, label], i) => (
                    <li key={k} className="min-w-0 flex-1">
                      <div className={`h-1.5 rounded-full ${i <= idx ? "bg-indigo-500" : "bg-zinc-200 dark:bg-white/10"}`} />
                      <div className={`mt-1 hidden truncate text-[11px] leading-tight sm:block ${i === idx ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-zinc-500"}`}>{label}</div>
                    </li>
                  ))}
                </ol>
                <p className="-mt-1 mb-2 text-xs text-zinc-500 sm:hidden">Етап {idx + 1} з {BATCH_STAGES.length}: <b className="text-indigo-700 dark:text-indigo-300">{BATCH_STAGES[idx]?.[1]}</b></p>
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>Вартість <b className="tabular-nums">{money(b.total_cost_uah)}</b></span>
                  <span>Факт за шт <b className="tabular-nums">{money(unit)}</b></span>
                  {plan ? (
                    <span>План {money(plan)}{" "}
                      {diff !== null && Math.abs(diff) >= 0.02 && <Badge tone={diff > 0 ? (diff > 0.1 ? "red" : "amber") : "green"}>{diff > 0 ? "+" : ""}{Math.round(diff * 100)}%</Badge>}
                    </span>
                  ) : <span className="text-xs text-zinc-500">план: вибери пропозицію в картці товару</span>}
                </div>
                {plan && diff !== null && diff > 0.1 && (
                  <p className="mb-2 text-xs text-red-600">Дорожче плану більш ніж на 10%. Перерахуй ціну продажу в картці товару, щоб не працювати в нуль.</p>
                )}
                <form action={updateBatch} className="flex flex-wrap gap-1.5">
                  <input type="hidden" name="id" value={b.id} />
                  <select name="stage" defaultValue={stage} className={miniInput} aria-label="Етап">
                    {BATCH_STAGES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <input type="date" name="eta_on" defaultValue={b.eta_on ?? ""} className={miniInput} aria-label="Очікувана дата" />
                  <input name="tracking" defaultValue={b.tracking ?? ""} placeholder="трек карго" className={`${miniInput} min-w-0 flex-1`} />
                  <button className="rounded-md bg-indigo-600 px-2.5 text-xs font-medium text-white">Зберегти</button>
                </form>
              </div>
            );
          })}
        </div>
      </Card>
      <AddForm title="Нова партія">
        <form action={createBatch} className="space-y-2.5">
          <FormGrid>
            <Select label="Товар" name="product_id" options={products} />
            <Field label="Кількість, шт" name="qty" type="number" required />
            <Field label="Повна вартість з доставкою, грн" name="total_cost_uah" type="number" />
            <Field label="Очікуємо на складі" name="eta_on" type="date" />
          </FormGrid>
          <Button>Додати партію</Button>
        </form>
      </AddForm>
    </div>
  );
}
