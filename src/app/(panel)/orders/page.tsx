import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { addBlacklist, createOrder, markArrived, markRepeatSent, markReviewAsked, removeBlacklist, updateOrder } from "../actions";
import type { Metadata } from "next";
import { AddForm, Badge, Button, Card, Field, FormGrid, PageHeader, Select, Stat, Stats, Table, Td, miniInput } from "@/components/ui";
import { ORDER_STATUSES, date, money, pct } from "@/lib/format";
import { LYING_DAYS, LYING_TEXT, PREPAY_FROM_UAH, REVIEW_DAYS, daysSince, normPhone, repeatText, reviewText, prepayReason, refusalBy, riskyPhones } from "@/lib/orders";
import { CopyButton } from "@/components/copy";

export const metadata: Metadata = { title: "Замовлення" };

const TONE: Record<string, "gray" | "green" | "red" | "amber" | "blue"> = {
  new: "amber", confirmed: "blue", shipped: "blue", delivered: "green", refused: "red", returned: "red", cancelled: "gray",
};

export default async function OrdersPage() {
  const { supabase } = await requireMember();
  const [{ data: orders }, products, { data: blacklist }, { data: costs }] = await Promise.all([
    supabase.from("orders").select("*, products(name)").order("created_at", { ascending: false }).limit(500),
    productOptions(supabase),
    supabase.from("blacklist").select("*").order("created_at", { ascending: false }),
    supabase.from("cost_settings").select("return_shipping_uah").eq("id", 1).single(),
  ]);

  const all = orders ?? [];
  const returnedRows = all.filter((o) => o.status === "returned" || o.status === "refused");
  const returnCost = returnedRows.length * Number(costs?.return_shipping_uah ?? 80);
  const finished = all.filter((o) => ["delivered", "refused", "returned"].includes(o.status));
  const delivered = all.filter((o) => o.status === "delivered");
  const refusalRate = finished.length ? (finished.length - delivered.length) / finished.length : null;
  const revenue = delivered.reduce((a, o) => a + Number(o.price_uah) * o.qty, 0);
  const open = all.filter((o) => ["new", "confirmed", "shipped"].includes(o.status));
  const avgCheck = delivered.length ? revenue / delivered.length : null;
  const channels = new Map<string, number>();
  for (const o of all) channels.set(o.channel ?? "—", (channels.get(o.channel ?? "—") ?? 0) + 1);
  const topChannel = [...channels.entries()].sort((a, b) => b[1] - a[1])[0];

  const risky = riskyPhones(all, blacklist ?? []);
  const prepay = new Map(all.map((o) => [o.id, ["new", "confirmed"].includes(o.status) ? prepayReason(o, risky, all) : null]));
  const needPrepay = all.filter((o) => prepay.get(o.id));
  const lying = all
    .filter((o) => o.status === "shipped" && (daysSince(o.arrived_at) ?? -1) >= LYING_DAYS)
    .sort((a, b) => a.arrived_at!.localeCompare(b.arrived_at!));
  const askReview = all.filter((o) => {
    const d = daysSince(o.delivered_at);
    return o.status === "delivered" && !o.review_asked_at && d !== null && d >= REVIEW_DAYS && d <= 30;
  });
  // Повторні продажі: отримали 30–60 днів тому, ще не писали, без відмов. Один рядок на телефон.
  const seen = new Set<string>();
  const repeat = all.filter((o) => {
    const d = daysSince(o.delivered_at ?? o.created_at);
    const p = normPhone(o.phone);
    if (o.status !== "delivered" || o.repeat_sent_at || d === null || d < 30 || d > 60 || !p || risky.has(p) || seen.has(p)) return false;
    seen.add(p);
    return !all.some((x) => normPhone(x.phone) === p && x.repeat_sent_at);
  }).slice(0, 10);
  const reports = [
    ["Товар", refusalBy(all, (o) => o.products?.name)],
    ["Канал", refusalBy(all, (o) => o.channel)],
    ["Місто", refusalBy(all, (o) => o.city?.split(/[,(]/)[0])],
  ] as const;
  const refusers = [...risky.entries()].filter(([, why]) => !why.startsWith("чорний"));

  return (
    <div className="space-y-4">
      <PageHeader title="Замовлення" subtitle="Тільки переписка, без дзвінків. Коли посилка прибула, натисни «прибула у відділення»: через 3 дні пульт нагадає написати покупцю." />
      <Stats>
        <Stat label="Усього" value={all.length} />
        <Stat label="Відкриті" value={open.length} tone={open.length ? "warn" : undefined} />
        <Stat label="Отримані" value={delivered.length} />
        <Stat label="Виручка" value={money(revenue)} hint="лише отримані" />
        <Stat label="Середній чек" value={money(avgCheck)} />
        <Stat label="Частка відмов" value={pct(refusalRate)} tone={refusalRate !== null && refusalRate > 0.2 ? "bad" : undefined} hint={topChannel ? `топ канал: ${topChannel[0]}` : undefined} />
      </Stats>
      {(lying.length > 0 || needPrepay.length > 0 || askReview.length > 0) && (
        <Card title="Потрібна дія">
          <ul className="space-y-2 text-sm">
            {lying.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <Badge tone="red">лежить {daysSince(o.arrived_at)} дн.</Badge>{" "}
                  {o.customer_name ?? o.phone ?? "Клієнт"} · {o.products?.name}
                  <span className="block text-xs text-zinc-500">Напиши в чат, поки посилка не поїхала назад: повернення коштує дві доставки.</span>
                </span>
                <CopyButton text={LYING_TEXT} />
              </li>
            ))}
            {needPrepay.map((o) => (
              <li key={o.id}>
                <Badge tone="amber">передоплата</Badge> {o.customer_name ?? o.phone ?? "Клієнт"} · {money(Number(o.price_uah) * o.qty)}
                <span className="block text-xs text-zinc-500">{prepay.get(o.id)}</span>
              </li>
            ))}
            {askReview.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <Badge tone="blue">попроси відгук</Badge> {o.customer_name ?? o.phone ?? "Клієнт"} · {o.products?.name}
                  <span className="block text-xs text-zinc-500">Отримав {daysSince(o.delivered_at)} дн. тому. Скопіюй текст, надішли в чат і натисни «надіслав».</span>
                </span>
                <span className="flex items-center gap-2">
                  <CopyButton text={reviewText(o.products?.name)} />
                  <form action={markReviewAsked}><input type="hidden" name="id" value={o.id} /><button className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">надіслав</button></form>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {repeat.length > 0 && (
        <Card title={`Повторні продажі · ${repeat.length}`}>
          <p className="mb-2 text-xs text-zinc-500">Пиши лише тим, з ким уже листувався в чаті і хто не просив не турбувати. Повторний покупець не коштує реклами.</p>
          <ul className="space-y-2 text-sm">
            {repeat.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{o.customer_name ?? o.phone} · {o.products?.name}<span className="block text-xs text-zinc-500">купив {daysSince(o.delivered_at ?? o.created_at)} дн. тому · {o.channel ?? "канал не вказано"}</span></span>
                <span className="flex items-center gap-2">
                  <CopyButton text={repeatText(o.customer_name, o.products?.name)} />
                  <form action={markRepeatSent}><input type="hidden" name="id" value={o.id} /><button className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">надіслав</button></form>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card pad={false} className="p-2 sm:p-3">
        <Table head={["Дата", "Товар", "Клієнт", "Сума", "Канал", "Статус", "ТТН / статус"]} empty={!all.length}>
          {all.map((o) => (
            <tr key={o.id}>
              <Td>{date(o.created_at)}</Td>
              <Td>{o.products?.name}{o.qty > 1 && ` × ${o.qty}`}</Td>
              <Td>
                {o.customer_name ?? "—"}<div className="text-xs text-zinc-500">{[o.phone, o.city].filter(Boolean).join(", ")}</div>
                {prepay.get(o.id) && <div className="mt-0.5"><Badge tone="amber">передоплата</Badge></div>}
              </Td>
              <Td>{money(Number(o.price_uah) * o.qty)}</Td>
              <Td>{o.channel ?? "—"}</Td>
              <Td>
                <Badge tone={TONE[o.status]}>{ORDER_STATUSES[o.status]}</Badge>
                {o.status === "shipped" && (
                  <form action={markArrived} className="mt-1">
                    <input type="hidden" name="id" value={o.id} />
                    {o.arrived_at
                      ? <button name="undo" value="1" className={`text-xs ${(daysSince(o.arrived_at) ?? 0) >= LYING_DAYS ? "font-medium text-red-600" : "text-zinc-500"}`}>у відділенні {daysSince(o.arrived_at)} дн.</button>
                      : <button className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">прибула у відділення</button>}
                  </form>
                )}
              </Td>
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
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Де відмовляються">
          {reports[0][1].length === 0 ? (
            <p className="text-sm text-zinc-500">З’явиться після перших отриманих посилок і відмов. Нормально до 10–15%. Якщо вище 20%, опис або фото обіцяють більше, ніж є.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {reports.map(([label, rows]) => (
                <div key={label}>
                  <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</h3>
                  <ul className="space-y-0.5 text-sm">
                    {rows.slice(0, 6).map((r) => (
                      <li key={r.name} className="flex justify-between gap-2">
                        <span className="truncate">{r.name}</span>
                        <span className={`shrink-0 tabular-nums ${r.rate > 0.2 ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}>{pct(r.rate)} <span className="text-xs">з {r.done}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={`Повернення і відмови · ${returnedRows.length}`}>
          <p className="mb-2 text-sm">Коштували ≈ <b>{money(returnCost)}</b> зворотної доставки{returnedRows.length ? ` (${money(Number(costs?.return_shipping_uah ?? 80))} кожне)` : ""}.</p>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Коли товар повернувся на склад</p>
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>Огляд: чи цілий товар, упаковка, комплектація. Сфотографуй.</li>
            <li>Цілий — перепакуй і назад у продаж (склад рахує його сам після статусу «Повернення»).</li>
            <li>Пошкоджений — уцінка на OLX або списання; напиши покупцю, якщо пошкодив він.</li>
            <li>Причина повернення — у «Банк питань»: часті причини треба закривати в описі картки.</li>
          </ol>
        </Card>

        <Card title={`Чорний список · ${(blacklist?.length ?? 0) + refusers.length}`}>
          <p className="mb-2 text-xs text-zinc-500">
            Тим, хто вже не забрав посилку, пульт сам пише «передоплата». Сюди вписуй шахраїв і грубіянів. Передоплату радимо й для замовлень від {PREPAY_FROM_UAH} грн.
          </p>
          <ul className="mb-2 divide-y divide-black/[.06] text-sm dark:divide-white/5">
            {(blacklist ?? []).map((b) => (
              <li key={b.phone} className="flex items-center justify-between gap-2 py-1">
                <span>+{b.phone} <span className="text-zinc-500">{b.reason}</span></span>
                <form action={removeBlacklist}><input type="hidden" name="phone" value={b.phone} /><button className="text-xs text-zinc-400 hover:text-red-600">прибрати</button></form>
              </li>
            ))}
            {refusers.map(([phone, why]) => (
              <li key={phone} className="flex justify-between gap-2 py-1"><span>+{phone}</span><span className="text-xs text-zinc-500">{why}</span></li>
            ))}
          </ul>
          <form action={addBlacklist} className="flex flex-wrap gap-1.5">
            <input name="phone" required placeholder="Телефон" className={`${miniInput} w-36`} />
            <input name="reason" placeholder="Чому" className={`${miniInput} min-w-0 flex-1`} />
            <button className="rounded-md bg-zinc-800 px-2.5 text-xs font-medium text-white dark:bg-zinc-200 dark:text-zinc-900">Додати</button>
          </form>
        </Card>
      </div>

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
