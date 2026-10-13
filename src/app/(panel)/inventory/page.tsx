import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { createBatch, updateBatch } from "../actions";
import type { Metadata } from "next";
import { AddForm, Badge, Button, Card, Field, FormGrid, PageHeader, Select, Stat, Stats, Table, Td, miniInput } from "@/components/ui";
import { BATCH_STATUSES, date, money } from "@/lib/format";
import { daysAgoIso } from "@/lib/orders";

export const metadata: Metadata = { title: "Склад" };

export default async function InventoryPage() {
  const { supabase } = await requireMember();
  const since = daysAgoIso(30);
  const [stock, batches, products, { data: sold }, { data: settings }] = await Promise.all([
    supabase.from("product_stock").select("*").or("in_stock.neq.0,incoming.neq.0"),
    supabase.from("inventory_batches").select("*, products(name)").order("ordered_on", { ascending: false }),
    productOptions(supabase),
    supabase.from("orders").select("product_id, qty").in("status", ["confirmed", "shipped", "delivered"]).gte("created_at", since),
    supabase.from("cost_settings").select("lead_days").eq("id", 1).single(),
  ]);
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
  const arrivedLong = new Set(all.filter((b) => b.status === "arrived" && b.arrived_on && b.arrived_on <= since.slice(0, 10)).map((b) => b.product_id));
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
      <Card title="Партії">
        <Table head={["Замовлено", "Товар", "Кількість", "Вартість", "За од.", "Статус"]} empty={!batches.data?.length}>
          {batches.data?.map((b) => (
            <tr key={b.id}>
              <Td>{date(b.ordered_on)}</Td>
              <Td>{b.products?.name}</Td>
              <Td>{b.qty}</Td>
              <Td>{money(b.total_cost_uah)}</Td>
              <Td>{money(Number(b.total_cost_uah) / b.qty)}</Td>
              <Td>
                <form action={updateBatch} className="flex gap-1">
                  <input type="hidden" name="id" value={b.id} />
                  <select name="status" defaultValue={b.status} className={miniInput}>
                    {Object.entries(BATCH_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className="rounded-md bg-indigo-600 px-2 text-xs font-medium text-white">ok</button>
                </form>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <AddForm title="Нова партія">
        <form action={createBatch} className="space-y-2.5">
          <FormGrid>
            <Select label="Товар" name="product_id" options={products} />
            <Field label="Кількість, шт" name="qty" type="number" required />
            <Field label="Повна вартість з доставкою, грн" name="total_cost_uah" type="number" />
            <Select label="Статус" name="status" options={BATCH_STATUSES} />
          </FormGrid>
          <Button>Додати партію</Button>
        </form>
      </AddForm>
    </div>
  );
}
