import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { createBatch, updateBatch } from "../actions";
import type { Metadata } from "next";
import { AddForm, Badge, Button, Card, Field, FormGrid, PageHeader, Select, Stat, Stats, Table, Td, miniInput } from "@/components/ui";
import { BATCH_STATUSES, date, money } from "@/lib/format";

export const metadata: Metadata = { title: "Склад" };

export default async function InventoryPage() {
  const { supabase } = await requireMember();
  const [stock, batches, products] = await Promise.all([
    supabase.from("product_stock").select("*").or("in_stock.neq.0,incoming.neq.0"),
    supabase.from("inventory_batches").select("*, products(name)").order("ordered_on", { ascending: false }),
    productOptions(supabase),
  ]);

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
      <Card title="Залишки">
        <Table head={["Товар", "На складі", "В дорозі"]} empty={!stock.data?.length}>
          {stock.data?.map((s) => (
            <tr key={s.product_id}>
              <Td>{s.name}</Td>
              <Td><Badge tone={Number(s.in_stock) <= 5 ? "red" : "green"}>{s.in_stock}</Badge></Td>
              <Td>{s.incoming}</Td>
            </tr>
          ))}
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
