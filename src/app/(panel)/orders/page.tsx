import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { createOrder, updateOrder } from "../actions";
import { Badge, Button, Card, Field, FormGrid, PageHeader, Select, Stat, Table, Td } from "@/components/ui";
import { ORDER_STATUSES, date, money, pct } from "@/lib/format";

const TONE: Record<string, "gray" | "green" | "red" | "amber" | "blue"> = {
  new: "amber", confirmed: "blue", shipped: "blue", delivered: "green", refused: "red", returned: "red", cancelled: "gray",
};

export default async function OrdersPage() {
  const { supabase } = await requireMember();
  const [{ data: orders }, products] = await Promise.all([
    supabase.from("orders").select("*, products(name)").order("created_at", { ascending: false }).limit(200),
    productOptions(supabase),
  ]);

  const all = orders ?? [];
  const finished = all.filter((o) => ["delivered", "refused", "returned"].includes(o.status));
  const delivered = all.filter((o) => o.status === "delivered");
  const refusalRate = finished.length ? (finished.length - delivered.length) / finished.length : null;
  const revenue = delivered.reduce((a, o) => a + Number(o.price_uah) * o.qty, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Замовлення" subtitle="ТТН поки вручну; API Нової пошти підключимо, коли буде ключ." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Усього замовлень" value={all.length} />
        <Stat label="Виручка (отримані)" value={money(revenue)} />
        <Stat label="Частка відмов" value={pct(refusalRate)} hint="закладено в Налаштуваннях" />
      </div>
      <Card>
        <Table head={["Дата", "Товар", "Клієнт", "Сума", "Канал", "Статус", "ТТН / статус"]} empty={!all.length}>
          {all.map((o) => (
            <tr key={o.id}>
              <Td>{date(o.created_at)}</Td>
              <Td>{o.products?.name}{o.qty > 1 && ` × ${o.qty}`}</Td>
              <Td>{o.customer_name ?? "—"}<div className="text-xs text-zinc-500">{[o.phone, o.city].filter(Boolean).join(", ")}</div></Td>
              <Td>{money(Number(o.price_uah) * o.qty)}</Td>
              <Td>{o.channel ?? "—"}</Td>
              <Td><Badge tone={TONE[o.status]}>{ORDER_STATUSES[o.status]}</Badge></Td>
              <Td>
                <form action={updateOrder} className="flex gap-1">
                  <input type="hidden" name="id" value={o.id} />
                  <input name="ttn" defaultValue={o.ttn ?? ""} placeholder="ТТН" className="w-32 rounded border border-black/15 px-1 dark:border-white/15 dark:bg-zinc-950" />
                  <select name="status" defaultValue={o.status} className="rounded border border-black/15 dark:border-white/15 dark:bg-zinc-950">
                    {Object.entries(ORDER_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className="text-sky-600">ok</button>
                </form>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="Нове замовлення">
        <form action={createOrder} className="space-y-3">
          <FormGrid>
            <Select label="Товар" name="product_id" options={products} />
            <Field label="Ціна за од., грн" name="price_uah" type="number" required />
            <Field label="Кількість" name="qty" type="number" defaultValue={1} />
            <Field label="Канал" name="channel" placeholder="Instagram, Prom…" />
            <Field label="Клієнт" name="customer_name" />
            <Field label="Телефон" name="phone" />
            <Field label="Місто / відділення" name="city" />
            <Field label="ТТН" name="ttn" />
          </FormGrid>
          <Button>Додати</Button>
        </form>
      </Card>
    </div>
  );
}
