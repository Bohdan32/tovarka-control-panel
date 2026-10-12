import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { createOrder, updateOrder } from "../actions";
import type { Metadata } from "next";
import { AddForm, Badge, Button, Card, Field, FormGrid, PageHeader, Select, Stat, Stats, Table, Td, miniInput } from "@/components/ui";
import { ORDER_STATUSES, date, money, pct } from "@/lib/format";

export const metadata: Metadata = { title: "Замовлення" };

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
  const open = all.filter((o) => ["new", "confirmed", "shipped"].includes(o.status));
  const avgCheck = delivered.length ? revenue / delivered.length : null;
  const channels = new Map<string, number>();
  for (const o of all) channels.set(o.channel ?? "—", (channels.get(o.channel ?? "—") ?? 0) + 1);
  const topChannel = [...channels.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-4">
      <PageHeader title="Замовлення" subtitle="Тільки переписка, без дзвінків. ТТН поки вручну; API Нової Пошти підключимо, коли буде ключ." />
      <Stats>
        <Stat label="Усього" value={all.length} />
        <Stat label="Відкриті" value={open.length} tone={open.length ? "warn" : undefined} />
        <Stat label="Отримані" value={delivered.length} />
        <Stat label="Виручка" value={money(revenue)} hint="лише отримані" />
        <Stat label="Середній чек" value={money(avgCheck)} />
        <Stat label="Частка відмов" value={pct(refusalRate)} tone={refusalRate !== null && refusalRate > 0.2 ? "bad" : undefined} hint={topChannel ? `топ канал: ${topChannel[0]}` : undefined} />
      </Stats>
      <Card pad={false} className="p-2 sm:p-3">
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
                <form action={updateOrder} className="flex flex-wrap justify-end gap-1 sm:justify-start">
                  <input type="hidden" name="id" value={o.id} />
                  <input name="ttn" defaultValue={o.ttn ?? ""} placeholder="ТТН" className={`${miniInput} w-28`} />
                  <select name="status" defaultValue={o.status} className={miniInput}>
                    {Object.entries(ORDER_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className="rounded-md bg-indigo-600 px-2 text-xs font-medium text-white">ok</button>
                </form>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      <AddForm title="Нове замовлення">
        <form action={createOrder} className="space-y-2.5">
          <FormGrid>
            <Select label="Товар" name="product_id" options={products} />
            <Field label="Ціна за од., грн" name="price_uah" type="number" required />
            <Field label="Кількість" name="qty" type="number" defaultValue={1} />
            <Select label="Канал" name="channel" options={{ Prom: "Prom", OLX: "OLX", Rozetka: "Rozetka", Instagram: "Instagram", TikTok: "TikTok", Telegram: "Telegram", Viber: "Viber", Сайт: "Сайт", Інше: "Інше" }} />
            <Field label="Клієнт" name="customer_name" />
            <Field label="Телефон" name="phone" />
            <Field label="Місто / відділення" name="city" />
            <Field label="ТТН" name="ttn" />
          </FormGrid>
          <Button>Додати</Button>
        </form>
      </AddForm>
    </div>
  );
}
