import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { ConfirmButton } from "@/components/confirm";
import {
  addCompetitorPrice, addDemandSignal, addOffer, createSource, createTask, deleteOffer, deleteProduct, saveTestReview, selectOffer, startTest, toggleBatchCheck, toggleListingCheck, updateProduct,
} from "../../actions";
import { BATCH_CHECKS, LISTING_CHECKS } from "@/lib/checks";
import { Icon } from "@/components/icons";
import { AddForm, Badge, Button, Card, Ext, Field, FormGrid, PageHeader, Progress, Select, Stat, Stats, Table, Td, TextArea } from "@/components/ui";
import { TaskList, sortTasks, type TaskRow } from "@/components/tasks";
import { PricingCard } from "@/components/pricing";
import { ScoreBars } from "@/components/score";
import { scoreParts } from "@/lib/score";
import { daysSince } from "@/lib/orders";
import { SOURCE_KINDS, SOURCE_TOPICS, STAGES, date, landedEstimate, money, num, pct, roughMargin, usd } from "@/lib/format";

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
  const [{ data: p }, signals, prices, economics, suppliers, sources, tasks, { data: settings }, { data: pOrders }, { data: pAds }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("demand_signals").select("*").eq("product_id", id).order("observed_on", { ascending: false }),
    supabase.from("competitor_prices").select("*").eq("product_id", id).order("price_uah"),
    supabase.from("offer_economics").select("*").eq("product_id", id).order("profit_per_sale_uah", { ascending: false }),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("research_sources").select("*").eq("product_id", id).order("checked_on", { ascending: false }),
    supabase.from("tasks").select("*, products(name), playbook_steps(n, title)").eq("product_id", id),
    supabase.from("cost_settings").select("usd_rate, fee_pct, tax_pct, default_cpa_uah, refusal_rate, return_shipping_uah").eq("id", 1).single(),
    supabase.from("orders").select("status, qty, price_uah").eq("product_id", id).neq("status", "cancelled"),
    supabase.from("ad_campaigns").select("spend_uah, started_on").eq("product_id", id),
  ]);
  if (!p) notFound();

  const selected = economics.data?.find((e) => e.is_selected) ?? economics.data?.[0];
  const priceList = (prices.data ?? []).map((c) => Number(c.price_uah));
  const minPrice = priceList.length ? Math.min(...priceList) : null;
  const maxPrice = priceList.length ? Math.max(...priceList) : null;
  const estLanded = landedEstimate(p, Number(settings?.usd_rate ?? 0));
  const estMargin = roughMargin(p.price_median_uah, estLanded);

  // Розбір тесту: 14 днів від першої реклами (або від «Беру в тест»), план проти факту.
  const adStart = (pAds ?? []).map((a) => a.started_on).filter(Boolean).sort()[0] ?? p.in_test_at;
  const testDays = daysSince(adStart);
  const t = (() => {
    const list = pOrders ?? [];
    const delivered = list.filter((o) => o.status === "delivered");
    const refused = list.filter((o) => o.status === "refused" || o.status === "returned").length;
    const units = delivered.reduce((a, o) => a + o.qty, 0);
    const revenue = delivered.reduce((a, o) => a + Number(o.price_uah) * o.qty, 0);
    const spend = (pAds ?? []).reduce((a, x) => a + Number(x.spend_uah), 0);
    const cpa = list.length ? spend / list.length : null;
    const price = units ? revenue / units : null;
    const refusalRate = delivered.length + refused ? refused / (delivered.length + refused) : null;
    const cut = Number(settings?.fee_pct ?? 0) + Number(settings?.tax_pct ?? 0);
    const landed = selected ? Number(selected.landed_cost_uah) : estLanded;
    const profit = price !== null && landed !== null && cpa !== null
      ? price * (1 - cut) - landed - cpa - (units ? (refused * Number(settings?.return_shipping_uah ?? 80)) / units : 0)
      : null;
    return {
      orders: list.length, units, spend, cpa, price, refusalRate, profit,
      plan: {
        cpa: Number(p.planned_cpa_uah ?? selected?.cpa_uah ?? settings?.default_cpa_uah ?? 0) || null,
        price: selected ? Number(selected.price_uah) : p.target_price_uah ? Number(p.target_price_uah) : null,
        refusalRate: Number(settings?.refusal_rate ?? 0.15),
        profit: selected ? Number(selected.profit_per_sale_uah) : null,
      },
    };
  })();
  const showReview = (testDays !== null && testDays >= 14) || Boolean(p.test_verdict);

  return (
    <div className="space-y-4">
      <div className="text-xs"><Link href="/products" className="text-zinc-500 hover:underline">← Товари</Link></div>
      <PageHeader
        title={p.name}
        subtitle={<span className="flex flex-wrap items-center gap-1.5"><Badge tone="blue">{STAGES[p.stage]}</Badge>{p.category ?? "без категорії"}{p.source_url && <> · <Ext href={p.source_url}>джерело ідеї</Ext></>}</span>}
      >
        {(p.stage === "idea" || p.stage === "demand") && (
          <form action={startTest}>
            <input type="hidden" name="product_id" value={p.id} />
            <ConfirmButton message="Беремо в тест? Створю 9 задач: зразки, фото, партія, картка, реклама." className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">Беру в тест</ConfirmButton>
          </form>
        )}
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={p.id} />
          <ConfirmButton message="Видалити товар разом з пропозиціями, цінами і задачами?" className="rounded-lg px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">Видалити товар</ConfirmButton>
        </form>
      </PageHeader>

      <Stats>
        <Stat label="Оцінка" value={p.score ?? "—"} hint={p.confidence !== null ? `впевненість ${p.confidence}%` : "впевненість не задана"} />
        <Stat label="Собівартість" value={selected ? money(selected.landed_cost_uah) : estLanded ? `≈ ${money(estLanded)}` : "—"} hint={selected ? "до складу в Україні" : "оцінка з банку"} />
        <Stat label="Ціна" value={money(selected?.price_uah)} hint={`рекомендована ${money(selected?.recommended_price_uah)}`} />
        <Stat label="Ринок" value={money(selected?.market_median_uah ?? p.price_median_uah)} hint={minPrice !== null ? `${money(minPrice)}–${money(maxPrice)} · ${priceList.length} цін` : p.price_min_uah ? `${money(p.price_min_uah)}–${money(p.price_max_uah)}` : "цін немає"} />
        <Stat label="Маржа" value={pct(selected?.margin ?? estMargin)} tone={selected ? (selected.passes ? "good" : "bad") : undefined} hint={`${money(selected?.profit_per_sale_uah)} з продажу`} />
        <Stat label="CPA max" value={money(selected?.cpa_max_uah)} hint={`план ${money(selected?.cpa_uah)}`} />
      </Stats>

      {p.stage === "test" && testDays !== null && testDays < 14 && !p.test_verdict && (
        <div className="rounded-xl border border-black/[.07] bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-900">
          <b>Тест іде {testDays} дн. з 14.</b> Не міняй усе одразу: збирай замовлення й цифри. Розбір «план проти факту» з’явиться тут через {14 - testDays} дн.
          <div className="mt-2"><Progress value={testDays / 14} /></div>
        </div>
      )}

      {showReview && (
        <Card title={`Розбір тесту${testDays !== null ? ` · ${testDays} дн.` : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-zinc-500"><th className="py-1 font-medium"></th><th className="py-1 font-medium">План</th><th className="py-1 font-medium">Факт</th></tr></thead>
              <tbody className="divide-y divide-black/[.06] dark:divide-white/5">
                {([
                  ["Ціна замовлення (CPA)", t.plan.cpa, t.cpa, "lower"],
                  ["Ціна продажу", t.plan.price, t.price, "higher"],
                  ["Прибуток з продажу", t.plan.profit, t.profit, "higher"],
                ] as const).map(([label, plan, fact, better]) => {
                  const ok = plan === null || fact === null ? null : better === "lower" ? fact <= plan : fact >= plan;
                  return (
                    <tr key={label}>
                      <td className="py-1.5">{label}</td>
                      <td className="py-1.5 tabular-nums">{money(plan)}</td>
                      <td className="py-1.5 tabular-nums">{fact === null ? "—" : <Badge tone={ok === null ? "gray" : ok ? "green" : "red"}>{money(fact)}</Badge>}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="py-1.5">Частка відмов</td>
                  <td className="py-1.5 tabular-nums">{pct(t.plan.refusalRate)}</td>
                  <td className="py-1.5 tabular-nums">{t.refusalRate === null ? "—" : <Badge tone={t.refusalRate <= t.plan.refusalRate ? "green" : "red"}>{pct(t.refusalRate)}</Badge>}</td>
                </tr>
                <tr><td className="py-1.5">Замовлень / продано</td><td className="py-1.5 text-zinc-500">30 за тест</td><td className="py-1.5 tabular-nums">{t.orders} / {t.units} шт</td></tr>
                <tr><td className="py-1.5">Витрачено на рекламу</td><td className="py-1.5"></td><td className="py-1.5 tabular-nums">{money(t.spend)}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {t.orders === 0
              ? "Замовлень немає — це теж відповідь. Перевір «Коли відмовляємось» у тезі."
              : t.profit !== null && t.profit > 0 && (t.cpa ?? 0) <= (t.plan.cpa ?? Infinity)
                ? "Тест вдався: продається з прибутком. Можна дозамовляти і додавати канали."
                : "Є продажі, але цифри гірші за план. Спершу міняй креатив або ціну, а не бюджет."}
          </p>
          <form action={saveTestReview} className="mt-3 space-y-2 border-t border-black/[.07] pt-3 dark:border-white/10">
            <input type="hidden" name="id" value={p.id} />
            <div className="flex flex-wrap gap-3 text-sm">
              {([["go", "Продовжуємо → «Продажі»"], ["fix", "Міняємо креатив/ціну, ще тиждень"], ["stop", "Зупиняємо → «Відкинуто»"]] as const).map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5"><input type="radio" name="test_verdict" value={v} defaultChecked={p.test_verdict === v} required /> {l}</label>
              ))}
            </div>
            <TextArea label="Урок для наступного товару" name="test_lesson" defaultValue={p.test_lesson} rows={2} placeholder="Що спрацювало, що ні, що зробиш інакше" />
            <Button>Зберегти розбір</Button>
          </form>
        </Card>
      )}

      <Card title={`З чого складається оцінка ${p.score ?? ""}`}>
        <ScoreBars parts={scoreParts(p, selected?.margin != null ? Number(selected.margin) : estMargin, signals.data?.length ?? 0)} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Теза і ризики">
          <div className="space-y-3">
            <Thesis label="Чому продаватиметься" text={p.thesis} />
            <Thesis label="Ризики" text={p.risks} tone="amber" />
            <Thesis label="Коли відмовляємось" text={p.kill_criteria} tone="red" />
            <Thesis label="Сезонність" text={p.seasonality} />
            {p.where_to_sell && <Thesis label="Де продавати" text={p.where_to_sell} />}
            {p.ad_angle && <Thesis label="Ідея реклами без обличчя" text={p.ad_angle} />}
            {p.bundle_with && <Thesis label="Комплект: з чим продавати разом" text={p.bundle_with} />}
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

      <PricingCard
        price={selected?.price_uah != null ? Number(selected.price_uah) : p.price_median_uah != null ? Number(p.price_median_uah) : null}
        landed={selected ? Number(selected.landed_cost_uah) : estLanded}
        fee={Number(selected?.fee_pct ?? settings?.fee_pct ?? 0.02) + Number(settings?.tax_pct ?? 0.06)}
        cpa={Number(selected?.cpa_uah ?? p.planned_cpa_uah ?? settings?.default_cpa_uah ?? 120)}
        reserve={Number(selected?.refusal_reserve_uah ?? Number(settings?.refusal_rate ?? 0.15) * Number(settings?.return_shipping_uah ?? 80))}
        market={selected?.market_median_uah != null ? Number(selected.market_median_uah) : p.price_median_uah != null ? Number(p.price_median_uah) : null}
      />

      {p.stage !== "rejected" && (() => {
        const checked: string[] = p.batch_check ?? [];
        const ready = checked.length === BATCH_CHECKS.length;
        const margin = selected?.margin ?? estMargin;
        return (
          <Card
            title={ready ? "Перед партією: усе перевірено, можна замовляти" : `Перед замовленням партії · ${checked.length} з ${BATCH_CHECKS.length}`}
            action={<span className="w-24"><Progress value={checked.length / BATCH_CHECKS.length} tone={ready ? "green" : "indigo"} /></span>}
          >
            {!ready && <p className="mb-2 text-xs text-zinc-500">Перша партія — найдорожча помилка новачка. Не замовляй, поки не відмічено всі пункти.</p>}
            <ul className="grid gap-1 sm:grid-cols-2">
              {BATCH_CHECKS.map(([key, label]) => {
                const on = checked.includes(key);
                return (
                  <li key={key}>
                    <form action={toggleBatchCheck}>
                      <input type="hidden" name="product_id" value={p.id} />
                      <input type="hidden" name="key" value={key} />
                      <button type="submit" className="flex w-full items-start gap-2 rounded-lg p-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-white/5">
                        <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/25 dark:border-white/25"}`}>
                          {on && <Icon name="check" className="size-3" />}
                        </span>
                        <span className={on ? "text-zinc-500 line-through" : ""}>
                          {label}
                          {key === "margin" && margin !== null && (
                            <span className={`ml-1 no-underline ${margin >= 0.3 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>(зараз {pct(margin)})</span>
                          )}
                        </span>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })()}

      {["economics", "test", "selling"].includes(p.stage) && (() => {
        const done: string[] = p.listing_check ?? [];
        const points = LISTING_CHECKS.filter(([k]) => done.includes(k)).reduce((a, [, , pts]) => a + pts, 0);
        return (
          <Card
            title={`Якість картки на майданчику · ${points} з 100`}
            action={<span className="w-24"><Progress value={points / 100} tone={points >= 80 ? "green" : "indigo"} /></span>}
          >
            <p className="mb-2 text-xs text-zinc-500">Від картки залежить, скільки людей клікне і купить. 80+ балів — можна запускати рекламу.</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {LISTING_CHECKS.map(([key, label, pts]) => {
                const on = done.includes(key);
                return (
                  <li key={key}>
                    <form action={toggleListingCheck}>
                      <input type="hidden" name="product_id" value={p.id} />
                      <input type="hidden" name="key" value={key} />
                      <button type="submit" className="flex w-full items-start gap-2 rounded-lg p-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-white/5">
                        <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/25 dark:border-white/25"}`}>
                          {on && <Icon name="check" className="size-3" />}
                        </span>
                        <span className={on ? "text-zinc-500 line-through" : ""}>{label} <span className="text-xs text-zinc-400">+{pts}</span></span>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })()}

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
            <div className="col-span-2"><Field label="Комплект: з чим продавати разом" name="bundle_with" defaultValue={p.bundle_with} placeholder="напр. наклейки-підписи до органайзера" /></div>
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
