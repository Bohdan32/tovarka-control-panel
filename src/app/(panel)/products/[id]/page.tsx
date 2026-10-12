import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { ConfirmButton } from "@/components/confirm";
import {
  addCompetitorPrice, addDemandSignal, addOffer, createSource, createTask, deleteOffer, deleteProduct, selectOffer, updateProduct,
} from "../../actions";
import { AddForm, Badge, Button, Card, Ext, Field, FormGrid, PageHeader, Select, Stat, Stats, Table, Td, TextArea } from "@/components/ui";
import { TaskList, sortTasks, type TaskRow } from "@/components/tasks";
import { SOURCE_KINDS, SOURCE_TOPICS, STAGES, date, money, num, pct, usd } from "@/lib/format";

function Thesis({ label, text, tone }: { label: string; text: string | null; tone?: "red" | "amber" }) {
  const color = tone === "red" ? "border-red-400" : tone === "amber" ? "border-amber-400" : "border-indigo-400";
  return (
    <div className={`border-l-2 pl-3 ${color}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <p className={`whitespace-pre-line text-sm ${text ? "" : "text-zinc-400"}`}>{text ?? "не заповнено"}</p>
    </div>
  );
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const { supabase } = await requireMember();
  const [{ data: p }, signals, prices, economics, suppliers, sources, tasks] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("demand_signals").select("*").eq("product_id", id).order("observed_on", { ascending: false }),
    supabase.from("competitor_prices").select("*").eq("product_id", id).order("price_uah"),
    supabase.from("offer_economics").select("*").eq("product_id", id).order("profit_per_sale_uah", { ascending: false }),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("research_sources").select("*").eq("product_id", id).order("checked_on", { ascending: false }),
    supabase.from("tasks").select("*, products(name), playbook_steps(n, title)").eq("product_id", id),
  ]);
  if (!p) notFound();

  const selected = economics.data?.find((e) => e.is_selected) ?? economics.data?.[0];
  const priceList = (prices.data ?? []).map((c) => Number(c.price_uah));
  const minPrice = priceList.length ? Math.min(...priceList) : null;
  const maxPrice = priceList.length ? Math.max(...priceList) : null;

  return (
    <div className="space-y-4">
      <div className="text-xs"><Link href="/products" className="text-zinc-500 hover:underline">← Товари</Link></div>
      <PageHeader
        title={p.name}
        subtitle={<span className="flex flex-wrap items-center gap-1.5"><Badge tone="blue">{STAGES[p.stage]}</Badge>{p.category ?? "без категорії"}{p.source_url && <> · <Ext href={p.source_url}>джерело ідеї</Ext></>}</span>}
      >
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={p.id} />
          <ConfirmButton message="Видалити товар разом з пропозиціями, цінами і задачами?" className="rounded-lg px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">Видалити товар</ConfirmButton>
        </form>
      </PageHeader>

      <Stats>
        <Stat label="Оцінка" value={p.score ?? "—"} hint={p.confidence !== null ? `впевненість ${p.confidence}%` : "впевненість не задана"} />
        <Stat label="Собівартість" value={money(selected?.landed_cost_uah)} hint="до складу в Україні" />
        <Stat label="Ціна" value={money(selected?.price_uah)} hint={`рекомендована ${money(selected?.recommended_price_uah)}`} />
        <Stat label="Ринок" value={money(selected?.market_median_uah)} hint={minPrice !== null ? `${money(minPrice)}–${money(maxPrice)} · ${priceList.length} цін` : "цін немає"} />
        <Stat label="Маржа" value={pct(selected?.margin)} tone={selected ? (selected.passes ? "good" : "bad") : undefined} hint={`${money(selected?.profit_per_sale_uah)} з продажу`} />
        <Stat label="CPA max" value={money(selected?.cpa_max_uah)} hint={`план ${money(selected?.cpa_uah)}`} />
      </Stats>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Теза і ризики">
          <div className="space-y-3">
            <Thesis label="Чому продаватиметься" text={p.thesis} />
            <Thesis label="Ризики" text={p.risks} tone="amber" />
            <Thesis label="Коли відмовляємось" text={p.kill_criteria} tone="red" />
            <Thesis label="Сезонність" text={p.seasonality} />
            <div className="text-xs text-zinc-500">Наступний перегляд: {date(p.next_review_on)}</div>
          </div>
        </Card>
        <Card title={`Задачі · ${(tasks.data ?? []).filter((t) => t.status === "todo" || t.status === "doing").length}`}>
          <TaskList tasks={sortTasks((tasks.data ?? []) as TaskRow[])} />
          <form action={createTask} className="mt-2 flex gap-2">
            <input type="hidden" name="product_id" value={p.id} />
            <input type="hidden" name="priority" value="2" />
            <input name="title" required placeholder="Нова задача по товару" className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-white/15 dark:bg-zinc-950" />
            <Button>Додати</Button>
          </form>
        </Card>
      </div>

      <AddForm title="Редагувати картку, тезу і ризики">
        <form action={updateProduct} className="space-y-2.5">
          <input type="hidden" name="id" value={p.id} />
          <FormGrid>
            <Field label="Назва" name="name" defaultValue={p.name} required />
            <Field label="Категорія" name="category" defaultValue={p.category} />
            <Select label="Етап" name="stage" options={STAGES} defaultValue={p.stage} />
            <Field label="Оцінка 0–100" name="score" type="number" defaultValue={p.score} />
            <Field label="Впевненість, %" name="confidence" type="number" defaultValue={p.confidence} />
            <Field label="Наступний перегляд" name="next_review_on" type="date" defaultValue={p.next_review_on} />
            <Field label="Вага, кг" name="weight_kg" type="number" defaultValue={p.weight_kg} />
            <Field label="Своя ціна, грн" name="target_price_uah" type="number" defaultValue={p.target_price_uah} placeholder="порожньо = рекомендована" />
            <Field label="Плановий CPA, грн" name="planned_cpa_uah" type="number" defaultValue={p.planned_cpa_uah} />
            <Field label="Джерело ідеї" name="source_url" defaultValue={p.source_url} />
            <div className="col-span-2"><Field label="Сезонність" name="seasonality" defaultValue={p.seasonality} /></div>
          </FormGrid>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <TextArea label="Чому продаватиметься" name="thesis" defaultValue={p.thesis} />
            <TextArea label="Ризики" name="risks" defaultValue={p.risks} />
            <TextArea label="Коли відмовляємось" name="kill_criteria" defaultValue={p.kill_criteria} />
          </div>
          <TextArea label="Нотатки" name="notes" defaultValue={p.notes} rows={2} />
          <Button>Зберегти</Button>
        </form>
      </AddForm>

      <Card title="Пропозиції постачальників і економіка" pad={false} className="pb-2">
        <div className="px-2 sm:px-3">
          <Table head={["Постачальник", "Ціна", "Вага", "MOQ", "Строк", "Собівартість", "Ціна продажу", "Маржа", "З продажу", ""]} empty={!economics.data?.length}>
            {economics.data?.map((e) => (
              <tr key={e.offer_id} className={e.is_selected ? "bg-indigo-50/60 dark:bg-indigo-500/10" : ""}>
                <Td>{e.supplier_name ?? "—"}{e.is_selected && <> <Badge tone="blue">обрана</Badge></>}</Td>
                <Td className="whitespace-nowrap">{usd(e.unit_price_usd)} + {usd(e.china_shipping_usd)}</Td>
                <Td>{num(e.weight_kg)} кг</Td>
                <Td>{e.moq ?? "—"}</Td>
                <Td>{e.lead_days ? `${e.lead_days} дн.` : "—"}</Td>
                <Td className="whitespace-nowrap">{money(e.landed_cost_uah)}</Td>
                <Td className="whitespace-nowrap">{money(e.price_uah)}</Td>
                <Td><Badge tone={e.passes ? "green" : "red"}>{pct(e.margin)}</Badge></Td>
                <Td className="whitespace-nowrap">{money(e.profit_per_sale_uah)}</Td>
                <Td className="whitespace-nowrap">
                  {!e.is_selected && (
                    <form action={selectOffer} className="inline">
                      <input type="hidden" name="product_id" value={p.id} />
                      <input type="hidden" name="offer_id" value={e.offer_id!} />
                      <button className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">обрати</button>
                    </form>
                  )}{" "}
                  <form action={deleteOffer} className="inline">
                    <input type="hidden" name="product_id" value={p.id} />
                    <input type="hidden" name="offer_id" value={e.offer_id!} />
                    <ConfirmButton message="Видалити пропозицію?" className="text-xs text-red-600 hover:underline">видалити</ConfirmButton>
                  </form>
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>

      <AddForm title="Додати пропозицію постачальника">
        <form action={addOffer} className="space-y-2.5">
          <input type="hidden" name="product_id" value={p.id} />
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
      </AddForm>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Ціни конкурентів · ${priceList.length}`}>
          <Table head={["Майданчик", "Ціна", "Продавець", "Дата"]} empty={!prices.data?.length}>
            {prices.data?.map((c) => (
              <tr key={c.id}>
                <Td><Ext href={c.url}>{c.marketplace}</Ext></Td>
                <Td className="whitespace-nowrap">{money(c.price_uah)}</Td>
                <Td>{c.seller ?? "—"}</Td>
                <Td>{date(c.observed_on)}</Td>
              </tr>
            ))}
          </Table>
          <div className="mt-3">
            <AddForm title="Додати ціну">
              <form action={addCompetitorPrice} className="grid grid-cols-2 gap-2.5">
                <input type="hidden" name="product_id" value={p.id} />
                <Select label="Майданчик" name="marketplace" options={{ Prom: "Prom", Rozetka: "Rozetka", OLX: "OLX", Epicentr: "Епіцентр", Allo: "Allo", Instagram: "Instagram", TikTok: "TikTok", Інше: "Інше" }} />
                <Field label="Ціна, грн" name="price_uah" type="number" required />
                <Field label="Продавець" name="seller" />
                <Field label="Посилання" name="url" />
                <div><Button>Додати</Button></div>
              </form>
            </AddForm>
          </div>
        </Card>

        <Card title={`Сигнали попиту · ${signals.data?.length ?? 0}`}>
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
          <div className="mt-3">
            <AddForm title="Додати сигнал">
              <form action={addDemandSignal} className="grid grid-cols-2 gap-2.5">
                <input type="hidden" name="product_id" value={p.id} />
                <Field label="Джерело" name="source" placeholder="Google Trends, Prom…" />
                <Field label="Метрика" name="metric" placeholder="запитів/міс, продавців…" />
                <Field label="Значення" name="value" type="number" />
                <Field label="Коментар" name="note" />
                <div><Button>Додати</Button></div>
              </form>
            </AddForm>
          </div>
        </Card>
      </div>

      <Card title={`Джерела по товару · ${sources.data?.length ?? 0}`}>
        {sources.data?.length ? (
          <ul className="divide-y divide-black/[.05] dark:divide-white/5">
            {sources.data.map((s) => (
              <li key={s.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Ext href={s.url}>{s.title}</Ext>
                  <Badge>{SOURCE_KINDS[s.kind] ?? s.kind}</Badge>
                  <Badge tone={(s.reliability ?? 0) >= 4 ? "green" : "amber"}>{s.reliability ?? "?"}/5</Badge>
                  <span className="text-xs text-zinc-500">{date(s.checked_on)}</span>
                </div>
                {s.finding && <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{s.finding}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Джерел ще немає. Без джерел оцінка — лише здогадка.</p>
        )}
        <div className="mt-3">
          <AddForm title="Додати джерело">
            <form action={createSource} className="space-y-2.5">
              <input type="hidden" name="product_id" value={p.id} />
              <FormGrid>
                <div className="col-span-2"><Field label="Посилання" name="url" required /></div>
                <Field label="Назва" name="title" />
                <Select label="Тип" name="kind" options={SOURCE_KINDS} defaultValue="marketplace" />
                <Select label="Тема" name="topic" options={SOURCE_TOPICS.map((t) => [t, t] as [string, string])} />
                <Select label="Надійність" name="reliability" options={{ "5": "5", "4": "4", "3": "3", "2": "2", "1": "1" }} defaultValue="3" />
              </FormGrid>
              <TextArea label="Що каже" name="finding" rows={2} />
              <Button>Додати</Button>
            </form>
          </AddForm>
        </div>
      </Card>

      {p.notes && <Card title="Нотатки"><p className="whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">{p.notes}</p></Card>}
      <p className="text-xs text-zinc-500">Оновлено {date(p.updated_at)}.</p>
    </div>
  );
}
