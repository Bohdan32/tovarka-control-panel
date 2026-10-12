import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import {
  addCompetitorPrice, addDemandSignal, addOffer, deleteOffer, deleteProduct, selectOffer, updateProduct,
} from "../../actions";
import { Badge, Button, Card, Ext, Field, FormGrid, PageHeader, Select, Stat, Table, Td, TextArea } from "@/components/ui";
import { STAGES, date, money, num, pct, usd } from "@/lib/format";

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const { supabase } = await requireMember();
  const [{ data: p }, signals, prices, economics, suppliers] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("demand_signals").select("*").eq("product_id", id).order("observed_on", { ascending: false }),
    supabase.from("competitor_prices").select("*").eq("product_id", id).order("price_uah"),
    supabase.from("offer_economics").select("*").eq("product_id", id).order("profit_per_sale_uah", { ascending: false }),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);
  if (!p) notFound();

  const selected = economics.data?.find((e) => e.is_selected) ?? economics.data?.[0];

  return (
    <div className="space-y-6">
      <PageHeader title={p.name} subtitle={`${STAGES[p.stage]} · ${p.category ?? "без категорії"}`}>
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={p.id} />
          <Button variant="danger">Видалити</Button>
        </form>
      </PageHeader>

      {selected && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Собівартість" value={money(selected.landed_cost_uah)} hint="до складу в Україні" />
          <Stat label="Ціна" value={money(selected.price_uah)} hint={`рекомендована ${money(selected.recommended_price_uah)}`} />
          <Stat label="Медіана ринку" value={money(selected.market_median_uah)} hint={`${selected.market_count} цін за 60 днів`} />
          <Stat label="Маржа" value={pct(selected.margin)} tone={selected.passes ? "good" : "bad"} hint={`${money(selected.profit_per_sale_uah)} з продажу`} />
          <Stat label="CPA max" value={money(selected.cpa_max_uah)} hint="дорожче реклама = мінус" />
        </div>
      )}

      <Card title="Картка товару">
        <form action={updateProduct} className="space-y-3">
          <input type="hidden" name="id" value={p.id} />
          <FormGrid>
            <Field label="Назва" name="name" defaultValue={p.name} required />
            <Field label="Категорія" name="category" defaultValue={p.category} />
            <Select label="Етап" name="stage" options={STAGES} defaultValue={p.stage} />
            <Field label="Оцінка 0–100" name="score" type="number" defaultValue={p.score} />
            <Field label="Вага, кг" name="weight_kg" type="number" defaultValue={p.weight_kg} />
            <Field label="Своя ціна, грн (порожньо = рекомендована)" name="target_price_uah" type="number" defaultValue={p.target_price_uah} />
            <Field label="Плановий CPA, грн" name="planned_cpa_uah" type="number" defaultValue={p.planned_cpa_uah} />
            <Field label="Джерело ідеї" name="source_url" defaultValue={p.source_url} />
          </FormGrid>
          <TextArea label="Нотатки" name="notes" defaultValue={p.notes} />
          <Button>Зберегти</Button>
        </form>
      </Card>

      <Card title="Пропозиції постачальників і економіка">
        <Table head={["Постачальник", "Ціна", "Карго, кг", "MOQ", "Собівартість", "Ціна продажу", "Маржа", "Фільтр", ""]} empty={!economics.data?.length}>
          {economics.data?.map((e) => (
            <tr key={e.offer_id} className={e.is_selected ? "bg-sky-50 dark:bg-sky-950/30" : ""}>
              <Td>{e.supplier_name ?? "—"}{e.is_selected && <> <Badge tone="blue">обрана</Badge></>}</Td>
              <Td>{usd(e.unit_price_usd)} + {usd(e.china_shipping_usd)}</Td>
              <Td>{num(e.weight_kg)}</Td>
              <Td>{e.moq ?? "—"}</Td>
              <Td>{money(e.landed_cost_uah)}</Td>
              <Td>{money(e.price_uah)}</Td>
              <Td>{pct(e.margin)}</Td>
              <Td><Badge tone={e.passes ? "green" : "red"}>{e.passes ? "проходить" : "ні"}</Badge></Td>
              <Td className="whitespace-nowrap">
                {!e.is_selected && (
                  <form action={selectOffer} className="inline">
                    <input type="hidden" name="product_id" value={p.id} />
                    <input type="hidden" name="offer_id" value={e.offer_id!} />
                    <button className="text-sky-600 hover:underline">обрати</button>
                  </form>
                )}{" "}
                <form action={deleteOffer} className="inline">
                  <input type="hidden" name="product_id" value={p.id} />
                  <input type="hidden" name="offer_id" value={e.offer_id!} />
                  <button className="text-red-600 hover:underline">×</button>
                </form>
              </Td>
            </tr>
          ))}
        </Table>
        <form action={addOffer} className="mt-6 space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
          <input type="hidden" name="product_id" value={p.id} />
          <h3 className="text-sm font-semibold">Додати пропозицію</h3>
          <FormGrid>
            <Select label="Постачальник" name="supplier_id" includeEmpty="—" options={(suppliers.data ?? []).map((s) => [s.id, s.name] as [string, string])} />
            <Field label="Ціна за од., $" name="unit_price_usd" type="number" required />
            <Field label="Доставка по Китаю, $/од." name="china_shipping_usd" type="number" />
            <Field label="Вага, кг (якщо інша)" name="weight_kg" type="number" />
            <Field label="MOQ, шт" name="moq" type="number" />
            <Field label="Строк, днів" name="lead_days" type="number" />
            <Field label="Посилання" name="url" />
            <Field label="Нотатки" name="notes" />
          </FormGrid>
          <Button>Додати пропозицію</Button>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Ціни конкурентів">
          <Table head={["Майданчик", "Ціна", "Продавець", "Дата"]} empty={!prices.data?.length}>
            {prices.data?.map((c) => (
              <tr key={c.id}>
                <Td><Ext href={c.url}>{c.marketplace}</Ext></Td>
                <Td>{money(c.price_uah)}</Td>
                <Td>{c.seller ?? "—"}</Td>
                <Td>{date(c.observed_on)}</Td>
              </tr>
            ))}
          </Table>
          <form action={addCompetitorPrice} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="product_id" value={p.id} />
            <Select label="Майданчик" name="marketplace" options={{ Prom: "Prom", Rozetka: "Rozetka", OLX: "OLX", Instagram: "Instagram", Інше: "Інше" }} />
            <Field label="Ціна, грн" name="price_uah" type="number" required />
            <Field label="Продавець" name="seller" />
            <Field label="Посилання" name="url" />
            <div><Button>Додати ціну</Button></div>
          </form>
        </Card>

        <Card title="Сигнали попиту">
          <Table head={["Джерело", "Метрика", "Значення", "Дата"]} empty={!signals.data?.length}>
            {signals.data?.map((s) => (
              <tr key={s.id}>
                <Td>{s.source}</Td>
                <Td>{s.metric}{s.note && <div className="text-xs text-zinc-500">{s.note}</div>}</Td>
                <Td>{num(s.value)}</Td>
                <Td>{date(s.observed_on)}</Td>
              </tr>
            ))}
          </Table>
          <form action={addDemandSignal} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="product_id" value={p.id} />
            <Field label="Джерело" name="source" placeholder="Google Trends, Prom…" />
            <Field label="Метрика" name="metric" placeholder="запитів/міс, продавців…" />
            <Field label="Значення" name="value" type="number" />
            <Field label="Коментар" name="note" />
            <div><Button>Додати сигнал</Button></div>
          </form>
        </Card>
      </div>
    </div>
  );
}
