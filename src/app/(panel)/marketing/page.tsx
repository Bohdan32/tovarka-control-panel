import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { createAsset, createCampaign, updateCampaign } from "../actions";
import type { Metadata } from "next";
import { AddForm, Badge, Button, Card, Ext, Field, FormGrid, PageHeader, Select, Stat, Stats, Table, Td, TextArea, miniInput } from "@/components/ui";
import { ASSET_KINDS, money } from "@/lib/format";

export const metadata: Metadata = { title: "Маркетинг" };

const CAMPAIGN_STATUS = { draft: "Чернетка", active: "Активна", stopped: "Зупинена" };
const AD_TO_ORDER: Record<string, string> = { Meta: "Instagram", Google: "Сайт", TikTok: "TikTok", Prom: "Prom" };
const ASSET_STATUS = { draft: "Чернетка", approved: "Погоджено", live: "Працює" };

export default async function MarketingPage() {
  const { supabase } = await requireMember();
  const [campaigns, assets, products, { data: settings }, { data: orders }] = await Promise.all([
    supabase.from("campaign_performance").select("*").order("started_on", { ascending: false }),
    supabase.from("marketing_assets").select("*, products(name)").order("created_at", { ascending: false }),
    productOptions(supabase),
    supabase.from("cost_settings").select("default_cpa_uah").eq("id", 1).single(),
    supabase.from("orders").select("channel, status, qty, price_uah").neq("status", "cancelled"),
  ]);

  const rows = campaigns.data ?? [];
  const spend = rows.reduce((a, c) => a + Number(c.spend_uah), 0);
  const ordersCount = rows.reduce((a, c) => a + Number(c.orders_count), 0);
  // Стоп-правило: дві допустимі ціни замовлення витрачено, а продажів немає.
  const limitOf = (c: (typeof rows)[number]) => Number(c.cpa_max_uah ?? settings?.default_cpa_uah ?? 0);
  const stop = rows.filter((c) => c.status === "active" && limitOf(c) > 0 && Number(c.orders_count) === 0 && Number(c.spend_uah) >= 2 * limitOf(c));
  // Звідки приходять замовлення: реклама Meta веде в Instagram, Google — на сайт.
  const byChannel = new Map<string, { orders: number; delivered: number; refused: number; revenue: number; spend: number }>();
  const ch = (k: string) => byChannel.get(k) ?? byChannel.set(k, { orders: 0, delivered: 0, refused: 0, revenue: 0, spend: 0 }).get(k)!;
  for (const o of orders ?? []) {
    const g = ch(o.channel?.trim() || "Інше");
    g.orders++;
    if (o.status === "delivered") { g.delivered++; g.revenue += Number(o.price_uah) * o.qty; }
    if (o.status === "refused" || o.status === "returned") g.refused++;
  }
  for (const c of rows) ch(AD_TO_ORDER[c.channel as string] ?? c.channel ?? "Інше").spend += Number(c.spend_uah);
  const channelRows = [...byChannel.entries()].sort((a, b) => b[1].orders - a[1].orders || b[1].spend - a[1].spend);
  const losing = rows.filter((c) => c.cpa_uah !== null && c.cpa_max_uah !== null && Number(c.cpa_uah) > Number(c.cpa_max_uah)).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Маркетинг" subtitle="Реклама порівнюється з CPA max: якщо замовлення дорожче, кампанія йде в мінус. Дві CPA max без продажу — сигнал зупинитись." />
      <Stats>
        <Stat label="Кампаній" value={rows.length} hint={`${rows.filter((c) => c.status === "active").length} активних`} />
        <Stat label="Витрачено" value={money(spend)} />
        <Stat label="Замовлень з реклами" value={ordersCount} />
        <Stat label="Середній CPA" value={money(ordersCount ? spend / ordersCount : null)} />
        <Stat label="У мінусі" value={losing} tone={losing ? "bad" : "good"} />
        <Stat label="Матеріалів" value={assets.data?.length ?? 0} hint={`${(assets.data ?? []).filter((a) => a.status === "live").length} працюють`} />
      </Stats>

      <Card title="Звідки прийшло замовлення">
        {channelRows.length ? (
          <Table head={["Канал", "Замовлень", "Отримали", "Відмови", "Виручка", "Реклама", "CPA"]}>
            {channelRows.map(([name, g]) => (
              <tr key={name}>
                <Td className="font-medium">{name}</Td>
                <Td>{g.orders}</Td>
                <Td>{g.delivered}</Td>
                <Td>{g.refused ? <Badge tone={g.refused / Math.max(g.delivered + g.refused, 1) > 0.2 ? "red" : "gray"}>{g.refused}</Badge> : 0}</Td>
                <Td>{money(g.revenue)}</Td>
                <Td>{g.spend ? money(g.spend) : <span className="text-zinc-500">безкоштовно</span>}</Td>
                <Td>{g.spend ? (g.orders ? money(g.spend / g.orders) : <Badge tone="red">0 замовлень</Badge>) : "—"}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="text-sm text-zinc-500">Тут з’явиться, який канал приносить замовлення і скільки коштує кожне. Канал вибирається при додаванні замовлення, бот ставить «Telegram» сам.</p>
        )}
        <p className="mt-2 text-xs text-zinc-500">Реклама Meta зараховується в Instagram, Google — у Сайт. Канал без витрат і з замовленнями — найдешевший, вкладай туди час.</p>
      </Card>

      {stop.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm dark:border-red-500/40 dark:bg-red-500/10">
          <p className="font-semibold text-red-700 dark:text-red-300">Зупини рекламу: {stop.map((c) => `${c.product_name}${c.name ? ` (${c.name})` : ""}`).join(", ")}</p>
          <p className="mt-1 text-red-700/80 dark:text-red-300/80">
            Витрачено вже дві допустимі ціни замовлення, а продажів немає. «Ще трошки» тут не допоможе: міняй відео, ціну або товар, а не бюджет.
          </p>
        </div>
      )}

      <Card title="Рекламні кампанії">
        <Table head={["Товар", "Канал", "Витрачено", "Замовлень", "CPA", "CPA max", "Статус", "Оновити"]} empty={!campaigns.data?.length}>
          {campaigns.data?.map((c) => {
            const over = c.cpa_uah !== null && c.cpa_max_uah !== null && Number(c.cpa_uah) > Number(c.cpa_max_uah);
            return (
              <tr key={c.id}>
                <Td>{c.product_name}{c.name && <div className="text-xs text-zinc-500">{c.name}</div>}</Td>
                <Td>{c.channel}</Td>
                <Td>{money(c.spend_uah)}</Td>
                <Td>{c.orders_count}</Td>
                <Td><Badge tone={c.cpa_uah === null ? "gray" : over ? "red" : "green"}>{money(c.cpa_uah)}</Badge></Td>
                <Td>{money(c.cpa_max_uah)}</Td>
                <Td>{CAMPAIGN_STATUS[c.status as keyof typeof CAMPAIGN_STATUS]}</Td>
                <Td>
                  <form action={updateCampaign} className="flex flex-wrap justify-end gap-1 sm:justify-start">
                    <input type="hidden" name="id" value={c.id!} />
                    <input name="spend_uah" type="number" step="any" defaultValue={c.spend_uah ?? 0} className={`${miniInput} w-20`} />
                    <input name="orders_count" type="number" defaultValue={c.orders_count ?? 0} className={`${miniInput} w-14`} />
                    <select name="status" defaultValue={c.status ?? "active"} className={miniInput}>
                      {Object.entries(CAMPAIGN_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button className="rounded-md bg-indigo-600 px-2 text-xs font-medium text-white">ok</button>
                  </form>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <AddForm title="Нова кампанія">
        <form action={createCampaign} className="space-y-2.5">
          <FormGrid>
            <Select label="Товар" name="product_id" options={products} />
            <Select label="Канал" name="channel" options={{ Meta: "Meta (FB/IG)", TikTok: "TikTok", Google: "Google", Prom: "Prom", Інше: "Інше" }} />
            <Field label="Назва" name="name" />
            <Field label="Витрачено, грн" name="spend_uah" type="number" />
          </FormGrid>
          <Button>Створити</Button>
        </form>
      </AddForm>

      <Card title="Лендінги, тексти, акаунти">
        <Table head={["Тип", "Назва", "Товар", "Статус", "Посилання"]} empty={!assets.data?.length}>
          {assets.data?.map((a) => (
            <tr key={a.id}>
              <Td>{ASSET_KINDS[a.kind]}</Td>
              <Td>
                <details>
                  <summary className="cursor-pointer">{a.title}</summary>
                  {a.content && <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-zinc-600 dark:text-zinc-400">{a.content}</pre>}
                </details>
              </Td>
              <Td>{a.products?.name ?? "—"}</Td>
              <Td><Badge tone={a.status === "live" ? "green" : a.status === "approved" ? "blue" : "gray"}>{ASSET_STATUS[a.status as keyof typeof ASSET_STATUS]}</Badge></Td>
              <Td><Ext href={a.url} /></Td>
            </tr>
          ))}
        </Table>
      </Card>
      <AddForm title="Новий лендінг, текст або акаунт">
        <form action={createAsset} className="space-y-2.5">
          <FormGrid>
            <Select label="Тип" name="kind" options={ASSET_KINDS} />
            <Field label="Назва" name="title" required />
            <Select label="Товар" name="product_id" options={products} includeEmpty="—" />
            <Field label="Посилання" name="url" />
          </FormGrid>
          <TextArea label="Текст" name="content" rows={4} />
          <Button>Додати</Button>
        </form>
      </AddForm>
    </div>
  );
}
