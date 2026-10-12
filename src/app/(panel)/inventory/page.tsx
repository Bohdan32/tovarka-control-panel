import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { createBatch, updateBatch } from "../actions";
import { Badge, Button, Card, Field, FormGrid, PageHeader, Select, Table, Td } from "@/components/ui";
import { BATCH_STATUSES, date, money } from "@/lib/format";

export default async function InventoryPage() {
  const { supabase } = await requireMember();
  const [stock, batches, products] = await Promise.all([
    supabase.from("product_stock").select("*").or("in_stock.neq.0,incoming.neq.0"),
    supabase.from("inventory_batches").select("*, products(name)").order("ordered_on", { ascending: false }),
    productOptions(supabase),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Склад і закупівлі" subtitle="Залишок = партії на складі мінус підтверджені, відправлені й отримані замовлення." />
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
                  <select name="status" defaultValue={b.status} className="rounded border border-black/15 dark:border-white/15 dark:bg-zinc-950">
                    {Object.entries(BATCH_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className="text-sky-600">ok</button>
                </form>
              </Td>
            </tr>
          ))}
        </Table>
        <form action={createBatch} className="mt-6 space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Нова партія</h3>
          <FormGrid>
            <Select label="Товар" name="product_id" options={products} />
            <Field label="Кількість, шт" name="qty" type="number" required />
            <Field label="Повна вартість з доставкою, грн" name="total_cost_uah" type="number" />
            <Select label="Статус" name="status" options={BATCH_STATUSES} />
          </FormGrid>
          <Button>Додати партію</Button>
        </form>
      </Card>
    </div>
  );
}
