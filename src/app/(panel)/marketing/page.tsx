import { requireMember } from "@/lib/auth";
import { productOptions } from "@/lib/products";
import { createAsset, createCampaign, updateCampaign } from "../actions";
import type { Metadata } from "next";
import { AddForm, Badge, Button, Card, Ext, Field, FormGrid, PageHeader, Select, Stat, Stats, Table, Td, TextArea, miniInput } from "@/components/ui";
import { ASSET_KINDS, money } from "@/lib/format";

export const metadata: Metadata = { title: "Маркетинг" };

const CAMPAIGN_STATUS = { draft: "Чернетка", active: "Активна", stopped: "Зупинена" };
const ASSET_STATUS = { draft: "Чернетка", approved: "Погоджено", live: "Працює" };

export default async function MarketingPage() {
  const { supabase } = await requireMember();
  const [campaigns, assets, products] = await Promise.all([
    supabase.from("campaign_performance").select("*").order("started_on", { ascending: false }),
    supabase.from("marketing_assets").select("*, products(name)").order("created_at", { ascending: false }),
    productOptions(supabase),
  ]);

  const rows = campaigns.data ?? [];
  const spend = rows.reduce((a, c) => a + Number(c.spend_uah), 0);
  const ordersCount = rows.reduce((a, c) => a + Number(c.orders_count), 0);
  const losing = rows.filter((c) => c.cpa_uah !== null && c.cpa_max_uah !== null && Number(c.cpa_uah) > Number(c.cpa_max_uah)).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Маркетинг" subtitle="Реклама порівнюється з CPA max: якщо замовлення дорожче, кампанія йде в мінус." />
      <Stats>
        <Stat label="Кампаній" value={rows.length} hint={`${rows.filter((c) => c.status === "active").length} активних`} />
        <Stat label="Витрачено" value={money(spend)} />
        <Stat label="Замовлень з реклами" value={ordersCount} />
        <Stat label="Середній CPA" value={money(ordersCount ? spend / ordersCount : null)} />
        <Stat label="У мінусі" value={losing} tone={losing ? "bad" : "good"} />
        <Stat label="Матеріалів" value={assets.data?.length ?? 0} hint={`${(assets.data ?? []).filter((a) => a.status === "live").length} працюють`} />
      </Stats>

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
